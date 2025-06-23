import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>
  ) {}

  async create(createDocumentDto: CreateDocumentDto, userId: number, file?: any): Promise<Document> {
    const document = this.documentsRepository.create({
      ...createDocumentDto,
      createdById: userId,
      status: 'draft'
    });

    // If file is provided, handle file upload
    if (file) {
      await this.handleFileUpload(document, file);
    }

    return this.documentsRepository.save(document);
  }

  async findUserDocuments(): Promise<Document[]> {
    return this.documentsRepository.find({
      where: {  },
      relations: [
        'createdBy',
        'updatedBy'
      ],
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findAllDocuments(currentUserId: number, userRoles: string[]): Promise<Document[]> {
    // Admin can see all documents
    if (userRoles.includes('admin')) {
      return this.documentsRepository.find({
        relations: [
          'createdBy',
          'updatedBy'
        ],
        order: {
          createdAt: 'DESC'
        }
      });
    }

    // Regular users can only see their own documents
    return this.documentsRepository.find({
      where: { createdById: currentUserId },
      relations: [
        'createdBy',
        'updatedBy'
      ],
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async searchAllDocuments(currentUserId: number, userRoles: string[], searchParams: {
    search?: string;
    userId?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const {
      search,
      userId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = searchParams;

    // Build query builder
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.createdBy', 'createdBy')
      .leftJoinAndSelect('document.updatedBy', 'updatedBy');

    // Apply access control
    if (!userRoles.includes('admin')) {
      // Regular users can only see their own documents
      queryBuilder.where('document.createdById = :currentUserId', { currentUserId });
    }

    // Add user filter (only for admins or if filtering own documents)
    if (userId) {
      if (userRoles.includes('admin')) {
        // Admin can filter by any user
        queryBuilder.andWhere('document.createdById = :userId', { userId });
      } else if (userId === currentUserId) {
        // Regular users can only filter by their own user ID
        queryBuilder.andWhere('document.createdById = :userId', { userId });
      } else {
        // Regular users cannot filter by other user IDs
        throw new ForbiddenException('You can only filter by your own user ID');
      }
    }

    // Add search filter
    if (search) {
      queryBuilder.andWhere(
        '(document.title ILIKE :search OR document.description ILIKE :search OR document.content ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Add sorting
    const validSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`document.${sortField}`, sortOrder);

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [documents, total] = await queryBuilder.getManyAndCount();

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    return {
      documents,
      total,
      page,
      limit,
      totalPages
    };
  }

  async searchUserDocuments(userId: number, searchParams: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const {
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = searchParams;

    // Build query builder
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.createdBy', 'createdBy')
      .leftJoinAndSelect('document.updatedBy', 'updatedBy')
      .where('document.createdById = :userId', { userId });

    // Add search filter
    if (search) {
      queryBuilder.andWhere(
        '(document.title ILIKE :search OR document.description ILIKE :search OR document.content ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Add sorting
    const validSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`document.${sortField}`, sortOrder);

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [documents, total] = await queryBuilder.getManyAndCount();

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    return {
      documents,
      total,
      page,
      limit,
      totalPages
    };
  }

  async findOne(id: number, userId: number, userRoles: string[]): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id },
      relations: [
        'createdBy',
        'updatedBy'
      ]
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check access permissions
    if (!this.canAccessDocument(document, userId, userRoles)) {
      throw new ForbiddenException('Access denied to this document');
    }

    return document;
  }

  async update(id: number, updateDocumentDto: UpdateDocumentDto, userId: number, userRoles: string[], file?: any): Promise<Document> {
    const document = await this.findOne(id, userId, userRoles);

    // Check if user can edit this document
    if (!this.canEditDocument(document, userId, userRoles)) {
      throw new ForbiddenException('You cannot edit this document');
    }

    // Update the document
    Object.assign(document, updateDocumentDto);
    document.updatedById = userId;

    // If file is provided, handle file upload
    if (file) {
      await this.handleFileUpload(document, file);
    }

    return this.documentsRepository.save(document);
  }

  async remove(id: number, userId: number, userRoles: string[]): Promise<void> {
    const document = await this.findOne(id, userId, userRoles);

    // Check if user can delete this document
    if (!this.canDeleteDocument(document, userId, userRoles)) {
      throw new ForbiddenException('You cannot delete this document');
    }

    // Delete associated file if it exists
    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await this.documentsRepository.remove(document);
  }

  async downloadFile(id: number, userId: number, userRoles: string[]): Promise<{ filePath: string; fileName: string }> {
    const document = await this.findOne(id, userId, userRoles);

    if (!document.filePath || !fs.existsSync(document.filePath)) {
      throw new NotFoundException('File not found');
    }

    return {
      filePath: document.filePath,
      fileName: document.originalFileName || document.fileName
    };
  }

  private async handleFileUpload(document: Document, file: any): Promise<void> {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, file.buffer);

    // Update document with file metadata
    document.fileName = fileName;
    document.originalFileName = file.originalname;
    document.filePath = filePath;
    document.fileSize = file.size;
    document.mimeType = file.mimetype;
  }

  private canAccessDocument(document: Document, userId: number, userRoles: string[]): boolean {
    // Admin can access all documents
    if (userRoles.includes('admin')) {
      return true;
    }

    // User can access their own documents
    if (document.createdById === userId) {
      return true;
    }

    return false;
  }

  private canEditDocument(document: Document, userId: number, userRoles: string[]): boolean {
    // Admin can edit all documents
    if (userRoles.includes('admin')) {
      return true;
    }

    // User can edit their own documents
    if (document.createdById === userId) {
      return true;
    }

    return false;
  }

  private canDeleteDocument(document: Document, userId: number, userRoles: string[]): boolean {
    // Admin can delete all documents
    if (userRoles.includes('admin')) {
      return true;
    }

    // User can delete their own documents
    if (document.createdById === userId) {
      return true;
    }

    return false;
  }
}