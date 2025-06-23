import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { TriggerIngestionDto } from './dto/trigger-ingestion.dto';
import { WebhookStatusUpdateDto } from './dto/webhook-status-update.dto';
import { IngestionJob, IngestionStatus, IngestionType } from './entities/ingestion-job.entity';
import { User } from '../users/entities/user.entity';

describe('IngestionController', () => {
  let controller: IngestionController;
  let service: IngestionService;

  const mockIngestionService = {
    triggerIngestion: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    retryJob: jest.fn(),
    updateJobStatus: jest.fn(),
  };

  const mockUser = {
    userId: 1,
    email: 'test@example.com',
    roles: ['admin'],
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
      documents: [],
    },
    outputData: null,
    externalJobId: 'ext_job_123',
    startedAt: null,
    completedAt: null,
    nextRetryAt: null,
    createdBy: {} as User,
    createdById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        {
          provide: IngestionService,
          useValue: mockIngestionService,
        },
      ],
    }).compile();

    controller = module.get<IngestionController>(IngestionController);
    service = module.get<IngestionService>(IngestionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerIngestion', () => {
    const triggerDto: TriggerIngestionDto = {
      name: 'Test OCR Job',
      description: 'Process test document',
      type: IngestionType.OCR,
      documentIds: [1],
      parameters: { language: 'en' },
      maxRetries: 3,
    };

    const mockRequest = {
      user: mockUser,
    };

    it('should successfully trigger an ingestion job', async () => {
      // Arrange
      mockIngestionService.triggerIngestion.mockResolvedValue(mockIngestionJob);

      // Act
      const result = await controller.triggerIngestion(triggerDto, mockRequest);

      // Assert
      expect(service.triggerIngestion).toHaveBeenCalledWith(triggerDto, mockUser.userId);
      expect(result).toEqual(mockIngestionJob);
    });

    it('should handle service errors properly', async () => {
      // Arrange
      const error = new BadRequestException('Invalid parameters');
      mockIngestionService.triggerIngestion.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.triggerIngestion(triggerDto, mockRequest)).rejects.toThrow(
        BadRequestException
      );
      expect(service.triggerIngestion).toHaveBeenCalledWith(triggerDto, mockUser.userId);
    });

    it('should handle missing optional fields', async () => {
      // Arrange
      const minimalDto = {
        type: IngestionType.OCR,
        documentIds: [1],
      };
      mockIngestionService.triggerIngestion.mockResolvedValue(mockIngestionJob);

      // Act
      const result = await controller.triggerIngestion(minimalDto, mockRequest);

      // Assert
      expect(service.triggerIngestion).toHaveBeenCalledWith(minimalDto, mockUser.userId);
      expect(result).toEqual(mockIngestionJob);
    });
  });

  describe('findAll', () => {
    const mockRequest = {
      user: mockUser,
    };

    const mockPaginatedResponse = {
      jobs: [mockIngestionJob],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('should return paginated ingestion jobs', async () => {
      // Arrange
      mockIngestionService.findAll.mockResolvedValue(mockPaginatedResponse);

      // Act
      const result = await controller.findAll(1, 10, mockRequest);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(mockUser.userId, 1, 10);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should use default pagination values when not provided', async () => {
      // Arrange
      mockIngestionService.findAll.mockResolvedValue(mockPaginatedResponse);

      // Act
      const result = await controller.findAll(undefined, undefined, mockRequest);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(mockUser.userId, 1, 10);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should handle service errors properly', async () => {
      // Arrange
      const error = new BadRequestException('Invalid pagination parameters');
      mockIngestionService.findAll.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findAll(1, 10, mockRequest)).rejects.toThrow(
        BadRequestException
      );
      expect(service.findAll).toHaveBeenCalledWith(mockUser.userId, 1, 10);
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
      mockIngestionService.findAll.mockResolvedValue(emptyResponse);

      // Act
      const result = await controller.findAll(1, 10, mockRequest);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(mockUser.userId, 1, 10);
      expect(result).toEqual(emptyResponse);
    });
  });

  describe('findOne', () => {
    const mockRequest = {
      user: mockUser,
    };

    it('should return a specific ingestion job', async () => {
      // Arrange
      mockIngestionService.findOne.mockResolvedValue(mockIngestionJob);

      // Act
      const result = await controller.findOne(1, mockRequest);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(1, mockUser.userId);
      expect(result).toEqual(mockIngestionJob);
    });

    it('should handle job not found error', async () => {
      // Arrange
      const error = new NotFoundException('Ingestion job not found');
      mockIngestionService.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findOne(999, mockRequest)).rejects.toThrow(NotFoundException);
      expect(service.findOne).toHaveBeenCalledWith(999, mockUser.userId);
    });

    it('should handle access denied error', async () => {
      // Arrange
      const error = new BadRequestException('Access denied to this ingestion job');
      mockIngestionService.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findOne(1, mockRequest)).rejects.toThrow(BadRequestException);
      expect(service.findOne).toHaveBeenCalledWith(1, mockUser.userId);
    });

    it('should handle invalid ID parameter', async () => {
      // Arrange
      const error = new BadRequestException('Invalid job ID');
      mockIngestionService.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findOne(0, mockRequest)).rejects.toThrow(BadRequestException);
      expect(service.findOne).toHaveBeenCalledWith(0, mockUser.userId);
    });
  });

  describe('retryJob', () => {
    const mockRequest = {
      user: mockUser,
    };

    it('should successfully retry a failed job', async () => {
      // Arrange
      const retryJob = { ...mockIngestionJob, status: IngestionStatus.RETRYING };
      mockIngestionService.retryJob.mockResolvedValue(retryJob);

      // Act
      const result = await controller.retryJob(1, mockRequest);

      // Assert
      expect(service.retryJob).toHaveBeenCalledWith(1, mockUser.userId);
      expect(result).toEqual(retryJob);
    });

    it('should handle job cannot be retried error', async () => {
      // Arrange
      const error = new BadRequestException('Only failed jobs can be retried');
      mockIngestionService.retryJob.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.retryJob(1, mockRequest)).rejects.toThrow(BadRequestException);
      expect(service.retryJob).toHaveBeenCalledWith(1, mockUser.userId);
    });

    it('should handle max retries reached error', async () => {
      // Arrange
      const error = new BadRequestException('Maximum retry attempts reached');
      mockIngestionService.retryJob.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.retryJob(1, mockRequest)).rejects.toThrow(BadRequestException);
      expect(service.retryJob).toHaveBeenCalledWith(1, mockUser.userId);
    });

    it('should handle job not found error', async () => {
      // Arrange
      const error = new NotFoundException('Ingestion job not found');
      mockIngestionService.retryJob.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.retryJob(999, mockRequest)).rejects.toThrow(NotFoundException);
      expect(service.retryJob).toHaveBeenCalledWith(999, mockUser.userId);
    });

    it('should handle access denied error', async () => {
      // Arrange
      const error = new BadRequestException('Access denied');
      mockIngestionService.retryJob.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.retryJob(1, mockRequest)).rejects.toThrow(BadRequestException);
      expect(service.retryJob).toHaveBeenCalledWith(1, mockUser.userId);
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
      mockIngestionService.updateJobStatus.mockResolvedValue(undefined);

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
      mockIngestionService.updateJobStatus.mockRejectedValue(error);

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

    it('should handle invalid status update error', async () => {
      // Arrange
      const error = new BadRequestException('Invalid status update');
      mockIngestionService.updateJobStatus.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.updateJobStatus(statusUpdateDto)).rejects.toThrow(BadRequestException);
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
      mockIngestionService.updateJobStatus.mockResolvedValue(undefined);

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
      mockIngestionService.updateJobStatus.mockResolvedValue(undefined);

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

    it('should handle missing optional fields in status update', async () => {
      // Arrange
      const minimalStatusUpdate: WebhookStatusUpdateDto = {
        externalJobId: 'ext_job_123',
        status: IngestionStatus.PROCESSING,
      };
      mockIngestionService.updateJobStatus.mockResolvedValue(undefined);

      // Act
      const result = await controller.updateJobStatus(minimalStatusUpdate);

      // Assert
      expect(service.updateJobStatus).toHaveBeenCalledWith(
        'ext_job_123',
        {
          status: 'processing',
          progress: undefined,
          error: undefined,
          output: undefined,
        }
      );
      expect(result).toEqual({ message: 'Status updated successfully' });
    });
  });

  describe('error handling', () => {
    const mockRequest = {
      user: mockUser,
    };

    it('should handle service throwing different types of errors', async () => {
      // Test various error types
      const errors = [
        new BadRequestException('Bad request'),
        new NotFoundException('Not found'),
        new Error('Generic error'),
      ];

      for (const error of errors) {
        mockIngestionService.triggerIngestion.mockRejectedValue(error);
        
        await expect(
          controller.triggerIngestion({ type: IngestionType.OCR, documentIds: [1] }, mockRequest)
        ).rejects.toThrow();
      }
    });

    it('should handle null or undefined user in request', async () => {
      // Arrange
      const invalidRequest = { user: null };
      mockIngestionService.triggerIngestion.mockRejectedValue(new Error('Invalid user'));

      // Act & Assert
      await expect(
        controller.triggerIngestion({ type: IngestionType.OCR, documentIds: [1] }, invalidRequest)
      ).rejects.toThrow();
    });
  });
}); 