import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IngestionJob, IngestionStatus, IngestionType } from './entities/ingestion-job.entity';
import { TriggerIngestionDto } from './dto/trigger-ingestion.dto';
import { Document } from '../documents/entities/document.entity';
import { ProcessingService, ProcessingType } from '../processing/processing.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private ingestionJobRepository: Repository<IngestionJob>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private processingService: ProcessingService,
  ) {}

  // Ingestion Trigger API
  async triggerIngestion(triggerDto: TriggerIngestionDto, userId: number): Promise<IngestionJob> {
    // Validate documents exist and belong to user
    const documents = await this.validateDocuments(triggerDto.documentIds, userId);

    // Create ingestion job
    const ingestionJob = this.ingestionJobRepository.create({
      name: triggerDto.name || `Ingestion Job ${new Date().toISOString()}`,
      description: triggerDto.description,
      type: triggerDto.type,
      status: IngestionStatus.PENDING,
      progress: 0,
      retryCount: 0,
      maxRetries: triggerDto.maxRetries || 3,
      parameters: triggerDto.parameters || {},
      inputData: {
        documentIds: triggerDto.documentIds,
        documents: documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          filePath: doc.filePath,
          fileName: doc.originalFileName,
          mimeType: doc.mimeType,
        })),
      },
      createdById: userId,
    });

    const savedJob = await this.ingestionJobRepository.save(ingestionJob);

    // Generate external job ID for consistency
    const externalJobId = `ext_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    savedJob.externalJobId = externalJobId;
    await this.ingestionJobRepository.save(savedJob);

    // Trigger internal processing asynchronously
    this.processJob(savedJob, documents).catch(error => {
      this.logger.error(`Failed to process job ${savedJob.id}:`, error);
    });

    return this.findOne(savedJob.id, userId);
  }

  // Ingestion Management API - Get all jobs for user
  async findAll(userId: number, page: number = 1, limit: number = 10): Promise<{
    jobs: IngestionJob[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const [jobs, total] = await this.ingestionJobRepository.findAndCount({
      where: { createdById: userId },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      jobs: jobs.map(job => this.formatJobResponse(job)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Ingestion Management API - Get specific job
  async findOne(id: number, userId: number): Promise<IngestionJob> {
    const job = await this.ingestionJobRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!job) {
      throw new NotFoundException('Ingestion job not found');
    }

    if (job.createdById !== userId) {
      throw new BadRequestException('Access denied to this ingestion job');
    }

    return this.formatJobResponse(job);
  }

  // Retry failed job
  async retryJob(id: number, userId: number): Promise<IngestionJob> {
    const job = await this.findOne(id, userId);

    if (job.status !== IngestionStatus.FAILED) {
      throw new BadRequestException('Only failed jobs can be retried');
    }

    if (job.retryCount >= job.maxRetries) {
      throw new BadRequestException('Maximum retry attempts reached');
    }

    // Reset job for retry
    job.status = IngestionStatus.RETRYING;
    job.progress = 0;
    job.errorMessage = null;
    job.retryCount += 1;
    job.nextRetryAt = null;

    const updatedJob = await this.ingestionJobRepository.save(job);

    // Get documents for this job
    const documentIds = job.inputData?.documentIds || [];
    const documents = await this.documentRepository.find({
      where: { id: In(documentIds) },
    });

    // Retry processing
    this.processJob(updatedJob, documents).catch(error => {
      this.logger.error(`Failed to retry processing for job ${job.id}:`, error);
    });

    return this.findOne(updatedJob.id, userId);
  }

  // Webhook for external service to update job status (kept for compatibility)
  async updateJobStatus(externalJobId: string, statusUpdate: any): Promise<void> {
    const job = await this.ingestionJobRepository.findOne({
      where: { externalJobId },
    });

    if (!job) {
      this.logger.warn(`Job with external ID ${externalJobId} not found`);
      return;
    }

    // Update job status based on external service response
    job.status = this.mapExternalStatus(statusUpdate.status);
    job.progress = statusUpdate.progress || job.progress;
    job.errorMessage = statusUpdate.error || job.errorMessage;
    job.outputData = statusUpdate.output || job.outputData;

    if (statusUpdate.status === 'processing' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (statusUpdate.status === 'completed') {
      job.completedAt = new Date();
      job.progress = 100;
    }

    if (statusUpdate.status === 'failed') {
      job.errorMessage = statusUpdate.error || 'Processing failed';
      
      // Schedule retry if retries remaining
      if (job.retryCount < job.maxRetries) {
        job.nextRetryAt = this.calculateNextRetry(job);
      }
    }

    await this.ingestionJobRepository.save(job);
  }

  // Private helper methods
  private async validateDocuments(documentIds: number[], userId: number): Promise<Document[]> {
    const documents = await this.documentRepository.find({
      where: { id: In(documentIds) },
    });

    if (documents.length !== documentIds.length) {
      throw new BadRequestException('Some documents not found');
    }

    // Check if all documents belong to the user
    const unauthorizedDocs = documents.filter(doc => doc.createdById !== userId);
    if (unauthorizedDocs.length > 0) {
      throw new BadRequestException('Access denied to some documents');
    }

    return documents;
  }

  private async processJob(job: IngestionJob, documents: Document[]): Promise<void> {
    try {
      this.logger.log(`Starting processing for job ${job.id}`);

      // Update job status to processing
      job.status = IngestionStatus.PROCESSING;
      job.startedAt = new Date();
      await this.ingestionJobRepository.save(job);

      // Map ingestion type to processing type
      const processingType = this.mapIngestionTypeToProcessingType(job.type);

      // Prepare documents for processing
      const documentInfos = documents.map(doc => ({
        id: doc.id,
        filePath: doc.filePath,
        fileName: doc.originalFileName,
        mimeType: doc.mimeType,
      }));

      // Process documents with progress updates
      const totalSteps = 10;
      for (let step = 0; step < totalSteps; step++) {
        // Update progress
        const progress = Math.round((step + 1) * 100 / totalSteps);
        job.progress = progress;
        await this.ingestionJobRepository.save(job);

        // Simulate processing time
        await this.delay(200);
      }

      // Perform actual processing
      const result = await this.processingService.processDocuments(
        processingType,
        documentInfos,
        job.parameters
      );

      if (result.success) {
        // Mark as completed
        job.status = IngestionStatus.COMPLETED;
        job.progress = 100;
        job.outputData = result.data;
        job.completedAt = new Date();
        
        this.logger.log(`Job ${job.id} completed successfully`);
      } else {
        // Mark as failed
        job.status = IngestionStatus.FAILED;
        job.errorMessage = result.error || 'Processing failed';
        job.completedAt = new Date();
        
        // Schedule retry if retries remaining
        if (job.retryCount < job.maxRetries) {
          job.nextRetryAt = this.calculateNextRetry(job);
        }
        
        this.logger.error(`Job ${job.id} failed: ${result.error}`);
      }

      await this.ingestionJobRepository.save(job);

    } catch (error) {
      this.logger.error(`Error processing job ${job.id}:`, error);
      
      // Mark as failed
      job.status = IngestionStatus.FAILED;
      job.errorMessage = error.message || 'Processing failed';
      job.completedAt = new Date();
      
      // Schedule retry if retries remaining
      if (job.retryCount < job.maxRetries) {
        job.nextRetryAt = this.calculateNextRetry(job);
      }

      await this.ingestionJobRepository.save(job);
    }
  }

  private mapIngestionTypeToProcessingType(ingestionType: IngestionType): ProcessingType {
    switch (ingestionType) {
      case IngestionType.OCR:
        return ProcessingType.OCR;
      case IngestionType.TEXT_EXTRACTION:
        return ProcessingType.TEXT_EXTRACTION;
      case IngestionType.DOCUMENT_CLASSIFICATION:
        return ProcessingType.DOCUMENT_CLASSIFICATION;
      case IngestionType.DATA_EXTRACTION:
        return ProcessingType.DATA_EXTRACTION;
      default:
        throw new Error(`Unknown ingestion type: ${ingestionType}`);
    }
  }

  private mapExternalStatus(externalStatus: string): IngestionStatus {
    const statusMap = {
      'pending': IngestionStatus.PENDING,
      'processing': IngestionStatus.PROCESSING,
      'completed': IngestionStatus.COMPLETED,
      'failed': IngestionStatus.FAILED,
    };

    return statusMap[externalStatus] || IngestionStatus.FAILED;
  }

  private calculateNextRetry(job: IngestionJob): Date {
    // Exponential backoff: 2^retryCount minutes
    const delayMinutes = Math.pow(2, job.retryCount);
    const maxDelayMinutes = 60; // Cap at 1 hour
    const actualDelayMinutes = Math.min(delayMinutes, maxDelayMinutes);
    
    return new Date(Date.now() + actualDelayMinutes * 60 * 1000);
  }

  private formatJobResponse(job: IngestionJob): any {
    return {
      ...job,
      createdBy: job.createdBy ? {
        id: job.createdBy.id,
        email: job.createdBy.email,
      } : null,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 