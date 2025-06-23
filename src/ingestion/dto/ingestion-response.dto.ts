import { ApiProperty } from '@nestjs/swagger';
import { IngestionStatus, IngestionType } from '../entities/ingestion-job.entity';

export class IngestionJobResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ enum: IngestionType })
  type: IngestionType;

  @ApiProperty({ enum: IngestionStatus })
  status: IngestionStatus;

  @ApiProperty({ minimum: 0, maximum: 100 })
  progress: number;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  maxRetries: number;

  @ApiProperty({ required: false })
  parameters?: any;

  @ApiProperty({ required: false })
  inputData?: any;

  @ApiProperty({ required: false })
  outputData?: any;

  @ApiProperty({ required: false })
  externalJobId?: string;

  @ApiProperty({ required: false })
  startedAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;

  @ApiProperty({ required: false })
  nextRetryAt?: Date;

  @ApiProperty()
  createdBy: {
    id: number;
    email: string;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
} 