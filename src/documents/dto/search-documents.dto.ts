import { IsOptional, IsString, IsBoolean, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export class SearchDocumentsDto {
  @ApiProperty({
    description: 'Search term for title or description',
    example: 'project requirements',
    required: false
  })
  @IsOptional()
  @IsString()
  search?: string;


  @ApiProperty({
    description: 'Filter by creator ID',
    example: 1,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  createdById?: number;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Sort field',
    example: 'createdAt',
    required: false
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Sort order',
    example: 'DESC',
    required: false
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
} 