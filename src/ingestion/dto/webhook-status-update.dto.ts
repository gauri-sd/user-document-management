import { IsString, IsNumber, IsOptional, IsObject, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IngestionStatus } from '../entities/ingestion-job.entity';

export class WebhookStatusUpdateDto {
  @ApiProperty({
    description: 'External job ID from the processing service',
    example: 'ext_job_12345'
  })
  @IsString()
  externalJobId: string;

  @ApiProperty({
    description: 'Current status of the job',
    enum: IngestionStatus,
    example: IngestionStatus.COMPLETED
  })
  @IsEnum(IngestionStatus)
  status: IngestionStatus;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiProperty({
    description: 'Error message if job failed',
    example: 'Document format not supported',
    required: false
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: 'Output data from processing',
    example: {
      extractedText: 'Sample extracted text',
      confidence: 0.95,
      tables: []
    },
    required: false
  })
  @IsOptional()
  @IsObject()
  output?: any;
} 