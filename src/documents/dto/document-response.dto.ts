import { ApiProperty } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Project Requirements Document' })
  title: string;

  @ApiProperty({ example: 'Detailed requirements for the new project' })
  description: string;

  @ApiProperty({ example: 'document_123.pdf' })
  fileName: string;

  @ApiProperty({ example: 'requirements.pdf' })
  originalFileName: string;

  @ApiProperty({ example: '/uploads/documents/document_123.pdf' })
  filePath: string;

  @ApiProperty({ example: 1024000 })
  fileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 'This document contains the project requirements...' })
  content: string;

  @ApiProperty({ example: 'published' })
  status: string;

  @ApiProperty({ example: false })
  isPublic: boolean;

  @ApiProperty({ example: 1 })
  createdById: number;

  @ApiProperty({ example: 'admin@example.com' })
  createdByEmail: string;

  @ApiProperty({ example: 1 })
  updatedById: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T14:45:00Z' })
  updatedAt: Date;
} 