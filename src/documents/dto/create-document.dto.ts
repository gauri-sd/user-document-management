import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Document title',
    example: 'Project Requirements Document'
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Document description',
    example: 'Detailed requirements for the new project',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Document content (for text documents)',
    example: 'This document contains the project requirements...',
    required: false
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Whether the document is public',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
} 