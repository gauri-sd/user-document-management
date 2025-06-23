import { ApiProperty } from '@nestjs/swagger';

export class DocumentSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Project Requirements Document' })
  title: string;

  @ApiProperty({ example: 'Detailed requirements for the new project' })
  description: string;

  @ApiProperty({ example: 'published' })
  status: string;

  @ApiProperty({ example: false })
  isPublic: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T14:45:00Z' })
  updatedAt: Date;
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: ['admin', 'editor'] })
  roles: string[];

  @ApiProperty({ type: [DocumentSummaryDto], description: 'Documents created by this user' })
  createdDocuments: DocumentSummaryDto[];

  @ApiProperty({ type: [DocumentSummaryDto], description: 'Documents updated by this user' })
  updatedDocuments: DocumentSummaryDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T14:45:00Z' })
  updatedAt: Date;
}

export class UserSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: ['admin', 'editor'] })
  roles: string[];

  @ApiProperty({ example: 5, description: 'Number of documents created by this user' })
  documentsCount: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;
} 