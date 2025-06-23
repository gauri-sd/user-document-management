import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { IngestionJob, IngestionStatus, IngestionType } from './entities/ingestion-job.entity';
import { Document } from '../documents/entities/document.entity';
import { ProcessingService, ProcessingType } from '../processing/processing.service';
import { TriggerIngestionDto } from './dto/trigger-ingestion.dto';
import { WebhookStatusUpdateDto } from './dto/webhook-status-update.dto';
import { User } from '../users/entities/user.entity';
import { validate } from 'class-validator';

describe('Ingestion Module', () => {
  let service: IngestionService;
  let controller: IngestionController;
  let ingestionJobRepository: Repository<IngestionJob>;
  let documentRepository: Repository<Document>;
  let processingService: ProcessingService;

  const mockIngestionJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
  };

  const mockDocumentRepository = {
    find: jest.fn(),
  };

  const mockProcessingService = {
    processDocument: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    roles: ['admin'],
    createdDocuments: [],
    updatedDocuments: []
  };

  const mockDocument = {
    id: 1,
    title: 'Test Document',
    fileName: 'test.pdf',
    originalFileName: 'test.pdf',
    filePath: '/uploads/test.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    createdById: 1,
    updatedById: 1,
  };

  const mockIngestionJob: IngestionJob = {
    id: 1,
    name: 'Test Ingestion Job',
    description: 'Test description',
    type: IngestionType.OCR,
    status: IngestionStatus.PENDING,
    progress: 0,
    errorMessage: null,
    retryCount: 0,
    maxRetries: 3,
    parameters: {},
    inputData: {
      documentIds: [1],
      documents: [mockDocument],
    },
    outputData: null,
    externalJobId: 'ext_job_123',
    startedAt: null,
    completedAt: null,
    nextRetryAt: null,
    createdBy: mockUser,
    createdById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(IngestionJob),
          useValue: mockIngestionJobRepository,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
        {
          provide: ProcessingService,
          useValue: mockProcessingService,
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    controller = module.get<IngestionController>(IngestionController);
    ingestionJobRepository = module.get<Repository<IngestionJob>>(getRepositoryToken(IngestionJob));
    documentRepository = module.get<Repository<Document>>(getRepositoryToken(Document));
    processingService = module.get<ProcessingService>(ProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IngestionService', () => {
    describe('triggerIngestion', () => {
      const triggerDto: TriggerIngestionDto = {
        name: 'Test OCR Job',
        description: 'Process test document',
        type: IngestionType.OCR,
        documentIds: [1],
        parameters: { language: 'en' },
        maxRetries: 3,
      };

      it('should successfully trigger an ingestion job', async () => {
        // Arrange
        mockDocumentRepository.find.mockResolvedValue([mockDocument]);
        mockIngestionJobRepository.create.mockReturnValue(mockIngestionJob);
        mockIngestionJobRepository.save.mockResolvedValue(mockIngestionJob);
        jest.spyOn(service as any, 'processJob').mockResolvedValue(undefined);
        jest.spyOn(service, 'findOne').mockResolvedValue(mockIngestionJob);

        // Act
        const result = await service.triggerIngestion(triggerDto, 1);

        // Assert
        expect(mockDocumentRepository.find).toHaveBeenCalledWith({
          where: { id: In([1]) },
        });
        expect(mockIngestionJobRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test OCR Job',
            description: 'Process test document',
            type: IngestionType.OCR,
            status: IngestionStatus.PENDING,
            progress: 0,
            retryCount: 0,
            maxRetries: 3,
            parameters: { language: 'en' },
            inputData: expect.objectContaining({
              documentIds: [1],
              documents: expect.arrayContaining([
                expect.objectContaining({
                  id: 1,
                  title: 'Test Document',
                  filePath: '/uploads/test.pdf',
                }),
              ]),
            }),
            createdById: 1,
          })
        );
        expect(mockIngestionJobRepository.save).toHaveBeenCalledTimes(2);
        expect(service['processJob']).toHaveBeenCalledWith(mockIngestionJob, [mockDocument]);
        expect(result).toEqual(mockIngestionJob);
      });

      it('should throw BadRequestException when documents not found', async () => {
        // Arrange
        mockDocumentRepository.find.mockResolvedValue([]);

        // Act & Assert
        await expect(service.triggerIngestion(triggerDto, 1)).rejects.toThrow(
          BadRequestException
        );
        expect(mockDocumentRepository.find).toHaveBeenCalledWith({
          where: { id: In([1]) },
        });
      });

      it('should throw BadRequestException when user does not have access to documents', async () => {
        // Arrange
        const unauthorizedDocument = { ...mockDocument, createdById: 2 };
        mockDocumentRepository.find.mockResolvedValue([unauthorizedDocument]);

        // Act & Assert
        await expect(service.triggerIngestion(triggerDto, 1)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should use default values when optional fields are not provided', async () => {
        // Arrange
        const minimalDto = {
          type: IngestionType.OCR,
          documentIds: [1],
        };
        mockDocumentRepository.find.mockResolvedValue([mockDocument]);
        mockIngestionJobRepository.create.mockReturnValue(mockIngestionJob);
        mockIngestionJobRepository.save.mockResolvedValue(mockIngestionJob);
        jest.spyOn(service as any, 'processJob').mockResolvedValue(undefined);
        jest.spyOn(service, 'findOne').mockResolvedValue(mockIngestionJob);

        // Act
        await service.triggerIngestion(minimalDto, 1);

        // Assert
        expect(mockIngestionJobRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: expect.stringMatching(/Ingestion Job/),
            maxRetries: 3,
            parameters: {},
          })
        );
      });
    });

    describe('findAll', () => {
      it('should return paginated ingestion jobs for user', async () => {
        // Arrange
        const mockJobs = [mockIngestionJob];
        mockIngestionJobRepository.findAndCount.mockResolvedValue([mockJobs, 1]);

        // Act
        const result = await service.findAll(1, 1, 10);

        // Assert
        expect(mockIngestionJobRepository.findAndCount).toHaveBeenCalledWith({
          where: { createdById: 1 },
          relations: ['createdBy'],
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        });
        expect(result).toEqual({
          jobs: [expect.objectContaining({ id: 1 })],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        });
      });

      it('should use default pagination values', async () => {
        // Arrange
        mockIngestionJobRepository.findAndCount.mockResolvedValue([[], 0]);

        // Act
        await service.findAll(1);

        // Assert
        expect(mockIngestionJobRepository.findAndCount).toHaveBeenCalledWith({
          where: { createdById: 1 },
          relations: ['createdBy'],
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        });
      });
    });

    describe('findOne', () => {
      it('should return ingestion job when found and user has access', async () => {
        // Arrange
        mockIngestionJobRepository.findOne.mockResolvedValue(mockIngestionJob);

        // Act
        const result = await service.findOne(1, 1);

        // Assert
        expect(mockIngestionJobRepository.findOne).toHaveBeenCalledWith({
          where: { id: 1 },
          relations: ['createdBy'],
        });
        expect(result).toEqual(expect.objectContaining({ id: 1 }));
      });

      it('should throw NotFoundException when job not found', async () => {
        // Arrange
        mockIngestionJobRepository.findOne.mockResolvedValue(null);

        // Act & Assert
        await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when user does not have access', async () => {
        // Arrange
        const unauthorizedJob = { ...mockIngestionJob, createdById: 2 };
        mockIngestionJobRepository.findOne.mockResolvedValue(unauthorizedJob);

        // Act & Assert
        await expect(service.findOne(1, 1)).rejects.toThrow(BadRequestException);
      });
    });

    describe('retryJob', () => {
      it('should successfully retry a failed job', async () => {
        // Arrange
        const failedJob = { ...mockIngestionJob, status: IngestionStatus.FAILED, retryCount: 1 };
        mockIngestionJobRepository.findOne.mockResolvedValue(failedJob);
        mockDocumentRepository.find.mockResolvedValue([mockDocument]);
        mockIngestionJobRepository.save.mockResolvedValue(failedJob);
        jest.spyOn(service as any, 'processJob').mockResolvedValue(undefined);
        jest.spyOn(service, 'findOne').mockResolvedValue(failedJob);

        // Act
        const result = await service.retryJob(1, 1);

        // Assert
        expect(mockIngestionJobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: IngestionStatus.RETRYING,
            progress: 0,
            errorMessage: null,
            retryCount: 2,
            nextRetryAt: null,
          })
        );
        expect(service['processJob']).toHaveBeenCalledWith(failedJob, [mockDocument]);
        expect(result).toEqual(failedJob);
      });

      it('should throw BadRequestException when job is not failed', async () => {
        // Arrange
        const pendingJob = { ...mockIngestionJob, status: IngestionStatus.PENDING };
        mockIngestionJobRepository.findOne.mockResolvedValue(pendingJob);

        // Act & Assert
        await expect(service.retryJob(1, 1)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when max retries reached', async () => {
        // Arrange
        const maxRetriesJob = { 
          ...mockIngestionJob, 
          status: IngestionStatus.FAILED, 
          retryCount: 3,
          maxRetries: 3 
        };
        mockIngestionJobRepository.findOne.mockResolvedValue(maxRetriesJob);

        // Act & Assert
        await expect(service.retryJob(1, 1)).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateJobStatus', () => {
      it('should update job status when job found', async () => {
        // Arrange
        const jobToUpdate = { ...mockIngestionJob, externalJobId: 'ext_job_123' };
        mockIngestionJobRepository.findOne.mockResolvedValue(jobToUpdate);
        mockIngestionJobRepository.save.mockResolvedValue(jobToUpdate);

        const statusUpdate = {
          status: 'processing',
          progress: 50,
          error: null,
          output: null,
        };

        // Act
        await service.updateJobStatus('ext_job_123', statusUpdate);

        // Assert
        expect(mockIngestionJobRepository.findOne).toHaveBeenCalledWith({
          where: { externalJobId: 'ext_job_123' },
        });
        expect(mockIngestionJobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: IngestionStatus.PROCESSING,
            progress: 50,
            startedAt: expect.any(Date),
          })
        );
      });

      it('should handle completed status correctly', async () => {
        // Arrange
        const jobToUpdate = { ...mockIngestionJob, externalJobId: 'ext_job_123' };
        mockIngestionJobRepository.findOne.mockResolvedValue(jobToUpdate);
        mockIngestionJobRepository.save.mockResolvedValue(jobToUpdate);

        const statusUpdate = {
          status: 'completed',
          progress: 100,
          output: { result: 'success' },
        };

        // Act
        await service.updateJobStatus('ext_job_123', statusUpdate);

        // Assert
        expect(mockIngestionJobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: IngestionStatus.COMPLETED,
            progress: 100,
            outputData: { result: 'success' },
            completedAt: expect.any(Date),
          })
        );
      });

      it('should handle failed status with retry scheduling', async () => {
        // Arrange
        const jobToUpdate = { 
          ...mockIngestionJob, 
          externalJobId: 'ext_job_123',
          retryCount: 1,
          maxRetries: 3,
        };
        mockIngestionJobRepository.findOne.mockResolvedValue(jobToUpdate);
        mockIngestionJobRepository.save.mockResolvedValue(jobToUpdate);

        const statusUpdate = {
          status: 'failed',
          error: 'Processing error',
        };

        // Act
        await service.updateJobStatus('ext_job_123', statusUpdate);

        // Assert
        expect(mockIngestionJobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: IngestionStatus.FAILED,
            errorMessage: 'Processing error',
            nextRetryAt: expect.any(Date),
          })
        );
      });

      it('should not schedule retry when max retries reached', async () => {
        // Arrange
        const jobToUpdate = { 
          ...mockIngestionJob, 
          externalJobId: 'ext_job_123',
          retryCount: 3,
          maxRetries: 3,
        };
        mockIngestionJobRepository.findOne.mockResolvedValue(jobToUpdate);
        mockIngestionJobRepository.save.mockResolvedValue(jobToUpdate);

        const statusUpdate = {
          status: 'failed',
          error: 'Processing error',
        };

        // Act
        await service.updateJobStatus('ext_job_123', statusUpdate);

        // Assert
        expect(mockIngestionJobRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: IngestionStatus.FAILED,
            errorMessage: 'Processing error',
            nextRetryAt: null,
          })
        );
      });

      it('should log warning when job not found', async () => {
        // Arrange
        mockIngestionJobRepository.findOne.mockResolvedValue(null);
        const loggerSpy = jest.spyOn(service['logger'], 'warn');

        // Act
        await service.updateJobStatus('nonexistent_job', { status: 'processing' });

        // Assert
        expect(loggerSpy).toHaveBeenCalledWith('Job with external ID nonexistent_job not found');
      });
    });

    describe('private helper methods', () => {
      describe('validateDocuments', () => {
        it('should return documents when all are found and accessible', async () => {
          // Arrange
          mockDocumentRepository.find.mockResolvedValue([mockDocument]);

          // Act
          const result = await service['validateDocuments']([1], 1);

          // Assert
          expect(result).toEqual([mockDocument]);
        });

        it('should throw BadRequestException when some documents not found', async () => {
          // Arrange
          mockDocumentRepository.find.mockResolvedValue([]);

          // Act & Assert
          await expect(service['validateDocuments']([1, 2], 1)).rejects.toThrow(
            BadRequestException
          );
        });

        it('should throw BadRequestException when user does not have access', async () => {
          // Arrange
          const unauthorizedDocument = { ...mockDocument, createdById: 2 };
          mockDocumentRepository.find.mockResolvedValue([unauthorizedDocument]);

          // Act & Assert
          await expect(service['validateDocuments']([1], 1)).rejects.toThrow(
            BadRequestException
          );
        });
      });

      describe('mapIngestionTypeToProcessingType', () => {
        it('should map OCR to OCR processing type', () => {
          const result = service['mapIngestionTypeToProcessingType'](IngestionType.OCR);
          expect(result).toBe(ProcessingType.OCR);
        });

        it('should map TEXT_EXTRACTION to TEXT_EXTRACTION processing type', () => {
          const result = service['mapIngestionTypeToProcessingType'](IngestionType.TEXT_EXTRACTION);
          expect(result).toBe(ProcessingType.TEXT_EXTRACTION);
        });

        it('should map DOCUMENT_CLASSIFICATION to CLASSIFICATION processing type', () => {
          const result = service['mapIngestionTypeToProcessingType'](IngestionType.DOCUMENT_CLASSIFICATION);
          expect(result).toBe(ProcessingType.DOCUMENT_CLASSIFICATION);
        });

        it('should map DATA_EXTRACTION to DATA_EXTRACTION processing type', () => {
          const result = service['mapIngestionTypeToProcessingType'](IngestionType.DATA_EXTRACTION);
          expect(result).toBe(ProcessingType.DATA_EXTRACTION);
        });
      });

      describe('mapExternalStatus', () => {
        it('should map external status to internal status correctly', () => {
          expect(service['mapExternalStatus']('pending')).toBe(IngestionStatus.PENDING);
          expect(service['mapExternalStatus']('processing')).toBe(IngestionStatus.PROCESSING);
          expect(service['mapExternalStatus']('completed')).toBe(IngestionStatus.COMPLETED);
          expect(service['mapExternalStatus']('failed')).toBe(IngestionStatus.FAILED);
          expect(service['mapExternalStatus']('unknown')).toBe(IngestionStatus.FAILED);
        });
      });

      describe('calculateNextRetry', () => {
        it('should calculate exponential backoff for retries', () => {
          const job = { ...mockIngestionJob, retryCount: 1 };
          const result = service['calculateNextRetry'](job);
          
          const expectedTime = new Date();
          expectedTime.setMinutes(expectedTime.getMinutes() + 2); // 2^1 = 2 minutes
          
          expect(result.getTime()).toBeCloseTo(expectedTime.getTime(), -3); // Within 1 second
        });
      });

      describe('formatJobResponse', () => {
        it('should format job response correctly', () => {
          const result = service['formatJobResponse'](mockIngestionJob);
          
          expect(result).toEqual({
            id: 1,
            name: 'Test Ingestion Job',
            description: 'Test description',
            type: IngestionType.OCR,
            status: IngestionStatus.PENDING,
            progress: 0,
            errorMessage: null,
            retryCount: 0,
            maxRetries: 3,
            parameters: {},
            inputData: expect.any(Object),
            outputData: null,
            externalJobId: expect.any(String),
            startedAt: null,
            completedAt: null,
            nextRetryAt: null,
            createdBy: expect.any(Object),
            createdById: 1,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          });
        });
      });
    });
  });

  describe('IngestionController', () => {
    const mockRequest = {
      user: {
        userId: 1,
        email: 'test@example.com',
        roles: ['admin'],
      },
    };

    describe('triggerIngestion', () => {
      const triggerDto: TriggerIngestionDto = {
        name: 'Test OCR Job',
        description: 'Process test document',
        type: IngestionType.OCR,
        documentIds: [1],
        parameters: { language: 'en' },
        maxRetries: 3,
      };

      it('should successfully trigger an ingestion job', async () => {
        // Arrange
        jest.spyOn(service, 'triggerIngestion').mockResolvedValue(mockIngestionJob);

        // Act
        const result = await controller.triggerIngestion(triggerDto, mockRequest);

        // Assert
        expect(service.triggerIngestion).toHaveBeenCalledWith(triggerDto, mockRequest.user.userId);
        expect(result).toEqual(mockIngestionJob);
      });

      it('should handle service errors properly', async () => {
        // Arrange
        const error = new BadRequestException('Invalid parameters');
        jest.spyOn(service, 'triggerIngestion').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.triggerIngestion(triggerDto, mockRequest)).rejects.toThrow(
          BadRequestException
        );
        expect(service.triggerIngestion).toHaveBeenCalledWith(triggerDto, mockRequest.user.userId);
      });

      it('should handle missing optional fields', async () => {
        // Arrange
        const minimalDto = {
          type: IngestionType.OCR,
          documentIds: [1],
        };
        jest.spyOn(service, 'triggerIngestion').mockResolvedValue(mockIngestionJob);

        // Act
        const result = await controller.triggerIngestion(minimalDto, mockRequest);

        // Assert
        expect(service.triggerIngestion).toHaveBeenCalledWith(minimalDto, mockRequest.user.userId);
        expect(result).toEqual(mockIngestionJob);
      });
    });

    describe('findAll', () => {
      const mockPaginatedResponse = {
        jobs: [mockIngestionJob],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      it('should return paginated ingestion jobs', async () => {
        // Arrange
        jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginatedResponse);

        // Act
        const result = await controller.findAll(1, 10, mockRequest);

        // Assert
        expect(service.findAll).toHaveBeenCalledWith(mockRequest.user.userId, 1, 10);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should use default pagination values when not provided', async () => {
        // Arrange
        jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginatedResponse);

        // Act
        const result = await controller.findAll(undefined, undefined, mockRequest);

        // Assert
        expect(service.findAll).toHaveBeenCalledWith(mockRequest.user.userId, 1, 10);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle service errors properly', async () => {
        // Arrange
        const error = new BadRequestException('Invalid pagination parameters');
        jest.spyOn(service, 'findAll').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.findAll(1, 10, mockRequest)).rejects.toThrow(
          BadRequestException
        );
        expect(service.findAll).toHaveBeenCalledWith(mockRequest.user.userId, 1, 10);
      });

      it('should handle empty results', async () => {
        // Arrange
        const emptyResponse = {
          jobs: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        };
        jest.spyOn(service, 'findAll').mockResolvedValue(emptyResponse);

        // Act
        const result = await controller.findAll(1, 10, mockRequest);

        // Assert
        expect(service.findAll).toHaveBeenCalledWith(mockRequest.user.userId, 1, 10);
        expect(result).toEqual(emptyResponse);
      });
    });

    describe('findOne', () => {
      it('should return a specific ingestion job', async () => {
        // Arrange
        jest.spyOn(service, 'findOne').mockResolvedValue(mockIngestionJob);

        // Act
        const result = await controller.findOne(1, mockRequest);

        // Assert
        expect(service.findOne).toHaveBeenCalledWith(1, mockRequest.user.userId);
        expect(result).toEqual(mockIngestionJob);
      });

      it('should handle job not found error', async () => {
        // Arrange
        const error = new NotFoundException('Ingestion job not found');
        jest.spyOn(service, 'findOne').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.findOne(999, mockRequest)).rejects.toThrow(NotFoundException);
        expect(service.findOne).toHaveBeenCalledWith(999, mockRequest.user.userId);
      });

      it('should handle access denied error', async () => {
        // Arrange
        const error = new BadRequestException('Access denied to this ingestion job');
        jest.spyOn(service, 'findOne').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.findOne(1, mockRequest)).rejects.toThrow(BadRequestException);
        expect(service.findOne).toHaveBeenCalledWith(1, mockRequest.user.userId);
      });
    });

    describe('retryJob', () => {
      it('should successfully retry a failed job', async () => {
        // Arrange
        const retryJob = { ...mockIngestionJob, status: IngestionStatus.RETRYING };
        jest.spyOn(service, 'retryJob').mockResolvedValue(retryJob);

        // Act
        const result = await controller.retryJob(1, mockRequest);

        // Assert
        expect(service.retryJob).toHaveBeenCalledWith(1, mockRequest.user.userId);
        expect(result).toEqual(retryJob);
      });

      it('should handle job cannot be retried error', async () => {
        // Arrange
        const error = new BadRequestException('Only failed jobs can be retried');
        jest.spyOn(service, 'retryJob').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.retryJob(1, mockRequest)).rejects.toThrow(BadRequestException);
        expect(service.retryJob).toHaveBeenCalledWith(1, mockRequest.user.userId);
      });

      it('should handle max retries reached error', async () => {
        // Arrange
        const error = new BadRequestException('Maximum retry attempts reached');
        jest.spyOn(service, 'retryJob').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.retryJob(1, mockRequest)).rejects.toThrow(BadRequestException);
        expect(service.retryJob).toHaveBeenCalledWith(1, mockRequest.user.userId);
      });
    });

    describe('updateJobStatus', () => {
      const statusUpdateDto: WebhookStatusUpdateDto = {
        externalJobId: 'ext_job_123',
        status: IngestionStatus.PROCESSING,
        progress: 50,
        error: null,
        output: null,
      };

      it('should successfully update job status', async () => {
        // Arrange
        jest.spyOn(service, 'updateJobStatus').mockResolvedValue(undefined);

        // Act
        const result = await controller.updateJobStatus(statusUpdateDto);

        // Assert
        expect(service.updateJobStatus).toHaveBeenCalledWith(
          'ext_job_123',
          {
            status: 'processing',
            progress: 50,
            error: null,
            output: null,
          }
        );
        expect(result).toEqual({ message: 'Status updated successfully' });
      });

      it('should handle job not found error', async () => {
        // Arrange
        const error = new NotFoundException('Job not found');
        jest.spyOn(service, 'updateJobStatus').mockRejectedValue(error);

        // Act & Assert
        await expect(controller.updateJobStatus(statusUpdateDto)).rejects.toThrow(NotFoundException);
        expect(service.updateJobStatus).toHaveBeenCalledWith(
          'ext_job_123',
          {
            status: 'processing',
            progress: 50,
            error: null,
            output: null,
          }
        );
      });

      it('should handle completed status update', async () => {
        // Arrange
        const completedStatusUpdate: WebhookStatusUpdateDto = {
          externalJobId: 'ext_job_123',
          status: IngestionStatus.COMPLETED,
          progress: 100,
          output: { result: 'success' },
        };
        jest.spyOn(service, 'updateJobStatus').mockResolvedValue(undefined);

        // Act
        const result = await controller.updateJobStatus(completedStatusUpdate);

        // Assert
        expect(service.updateJobStatus).toHaveBeenCalledWith(
          'ext_job_123',
          {
            status: 'completed',
            progress: 100,
            error: undefined,
            output: { result: 'success' },
          }
        );
        expect(result).toEqual({ message: 'Status updated successfully' });
      });

      it('should handle failed status update', async () => {
        // Arrange
        const failedStatusUpdate: WebhookStatusUpdateDto = {
          externalJobId: 'ext_job_123',
          status: IngestionStatus.FAILED,
          error: 'Processing failed',
        };
        jest.spyOn(service, 'updateJobStatus').mockResolvedValue(undefined);

        // Act
        const result = await controller.updateJobStatus(failedStatusUpdate);

        // Assert
        expect(service.updateJobStatus).toHaveBeenCalledWith(
          'ext_job_123',
          {
            status: 'failed',
            progress: undefined,
            error: 'Processing failed',
            output: undefined,
          }
        );
        expect(result).toEqual({ message: 'Status updated successfully' });
      });
    });

    describe('error handling', () => {
      it('should handle service throwing different types of errors', async () => {
        // Test various error types
        const errors = [
          new BadRequestException('Bad request'),
          new NotFoundException('Not found'),
          new Error('Generic error'),
        ];

        for (const error of errors) {
          jest.spyOn(service, 'triggerIngestion').mockRejectedValue(error);
          
          await expect(
            controller.triggerIngestion({ type: IngestionType.OCR, documentIds: [1] }, mockRequest)
          ).rejects.toThrow();
        }
      });

      it('should handle null or undefined user in request', async () => {
        // Arrange
        const invalidRequest = { user: null };
        jest.spyOn(service, 'triggerIngestion').mockRejectedValue(new Error('Invalid user'));

        // Act & Assert
        await expect(
          controller.triggerIngestion({ type: IngestionType.OCR, documentIds: [1] }, invalidRequest)
        ).rejects.toThrow();
      });
    });
  });

  describe('DTO Validation', () => {
    describe('TriggerIngestionDto', () => {
      it('should validate a valid DTO', async () => {
        const dto = new TriggerIngestionDto();
        dto.type = IngestionType.OCR;
        dto.documentIds = [1, 2, 3];
        dto.name = 'Test Job';
        dto.description = 'Test Description';
        dto.parameters = { language: 'en' };
        dto.maxRetries = 3;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });

      it('should fail validation when type is missing', async () => {
        const dto = new TriggerIngestionDto();
        dto.documentIds = [1, 2, 3];

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'type')).toBe(true);
      });

      it('should fail validation when documentIds is missing', async () => {
        const dto = new TriggerIngestionDto();
        dto.type = IngestionType.OCR;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'documentIds')).toBe(true);
      });

      it('should fail validation when documentIds is empty', async () => {
        const dto = new TriggerIngestionDto();
        dto.type = IngestionType.OCR;
        dto.documentIds = [];

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'documentIds')).toBe(true);
      });

      it('should fail validation when maxRetries is out of range', async () => {
        const dto = new TriggerIngestionDto();
        dto.type = IngestionType.OCR;
        dto.documentIds = [1];
        dto.maxRetries = 15; // Should be max 10

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'maxRetries')).toBe(true);
      });

      it('should pass validation with minimal required fields', async () => {
        const dto = new TriggerIngestionDto();
        dto.type = IngestionType.OCR;
        dto.documentIds = [1];

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });
    });

    describe('WebhookStatusUpdateDto', () => {
      it('should validate a valid DTO', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.externalJobId = 'ext_job_123';
        dto.status = IngestionStatus.PROCESSING;
        dto.progress = 50;
        dto.error = 'Test error';
        dto.output = { result: 'success' };

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });

      it('should fail validation when externalJobId is missing', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.status = IngestionStatus.PROCESSING;

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'externalJobId')).toBe(true);
      });

      it('should fail validation when status is missing', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.externalJobId = 'ext_job_123';

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'status')).toBe(true);
      });

      it('should fail validation when progress is out of range', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.externalJobId = 'ext_job_123';
        dto.status = IngestionStatus.PROCESSING;
        dto.progress = 150; // Should be 0-100

        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.property === 'progress')).toBe(true);
      });

      it('should pass validation with minimal required fields', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.externalJobId = 'ext_job_123';
        dto.status = IngestionStatus.COMPLETED;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });

      it('should pass validation with all optional fields', async () => {
        const dto = new WebhookStatusUpdateDto();
        dto.externalJobId = 'ext_job_123';
        dto.status = IngestionStatus.FAILED;
        dto.progress = 0;
        dto.error = 'Processing failed';
        dto.output = { error: 'details' };

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });
    });
  });
}); 