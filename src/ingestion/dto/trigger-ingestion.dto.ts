import { IsString, IsEnum, IsArray, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IngestionType } from '../entities/ingestion-job.entity';

export class TriggerIngestionDto {
  @ApiProperty({
    description: 'Name of the ingestion job',
    example: 'OCR Processing for Invoices',
    required: false
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Description of the ingestion job',
    example: 'Process uploaded invoice documents using OCR',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Type of ingestion processing',
    enum: IngestionType,
    example: IngestionType.OCR
  })
  @IsEnum(IngestionType)
  type: IngestionType;

  @ApiProperty({
    description: 'Array of document IDs to process',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  documentIds: number[];

  @ApiProperty({
    description: 'Processing parameters',
    example: {
      language: 'en',
      confidence: 0.8,
      extractTables: true
    },
    required: false
  })
  @IsOptional()
  @IsObject()
  parameters?: any;

  @ApiProperty({
    description: 'Maximum number of retries',
    example: 3,
    minimum: 0,
    maximum: 10,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;
} 