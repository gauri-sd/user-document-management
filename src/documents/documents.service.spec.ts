import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/constants';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: Repository<Document>;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    password: 'password123',
    roles: [UserRole.EDITOR],
    createdDocuments: [],
    updatedDocuments: [],
  };

  const mockDocument: Document = {
    id: 1,
    title: 'Test Document',
    description: 'Test description',
    fileName: 'test.pdf',
    originalFileName: 'test.pdf',
    filePath: '/uploads/test.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    content: 'Test content',
    status: 'draft',
    createdBy: mockUser,
    createdById: mockUser.id,
    updatedBy: null,
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateDocumentDto: CreateDocumentDto = {
    title: 'New Document',
    description: 'New document description',
    content: 'New content',
  };

  const mockUpdateDocumentDto: UpdateDocumentDto = {
    title: 'Updated Document',
    description: 'Updated description',
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new document successfully', async () => {
      const newDocument = { ...mockDocument, id: 2, title: mockCreateDocumentDto.title };

      mockRepository.create.mockReturnValue(newDocument);
      mockRepository.save.mockResolvedValue(newDocument);

      const result = await service.create(mockCreateDocumentDto, mockUser.id);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...mockCreateDocumentDto,
        createdById: mockUser.id,
        status: 'draft',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newDocument);
      expect(result).toEqual(newDocument);
    });

    it('should create a document with file upload', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        buffer: Buffer.from('test content'),
        size: 1024,
        mimetype: 'application/pdf',
      };
      const newDocument = { ...mockDocument, id: 2, title: mockCreateDocumentDto.title };

      mockRepository.create.mockReturnValue(newDocument);
      mockRepository.save.mockResolvedValue(newDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const result = await service.create(mockCreateDocumentDto, mockUser.id, mockFile);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(newDocument);
      expect(result).toEqual(newDocument);
    });
  });

  describe('findUserDocuments', () => {
    it('should return user documents', async () => {
      const documents = [mockDocument];
      mockRepository.find.mockResolvedValue(documents);

      const result = await service.findUserDocuments();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {  },
        relations: ['createdBy', 'updatedBy'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(documents);
    });
  });

  describe('searchUserDocuments', () => {
    it('should return paginated documents with search and filters', async () => {
      const userId = 1;
      const searchParams = {
        search: 'test',
        page: 1,
        limit: 10,
        sortBy: 'title',
        sortOrder: 'ASC' as const
      };

      const mockDocuments = [
        {
          id: 1,
          title: 'Test Document',
          description: 'Test description',
          content: 'Test content',
          status: 'published',
          filePath: '/path/to/file.pdf',
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockDocuments, 1])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchUserDocuments(userId, searchParams);

      expect(result).toEqual({
        documents: mockDocuments,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('document');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('document.createdBy', 'createdBy');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('document.updatedBy', 'updatedBy');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('document.createdById = :userId', { userId });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(document.title ILIKE :search OR document.description ILIKE :search OR document.content ILIKE :search)',
        { search: '%test%' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.status = :status', { status: 'published' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.filePath IS NOT NULL');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('document.title', 'ASC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should handle documents without files filter', async () => {
      const userId = 1;
      const searchParams = {
        page: 1,
        limit: 5
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchUserDocuments(userId, searchParams);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.filePath IS NULL');
      expect(result.totalPages).toBe(0);
    });

    it('should use default values when search params are not provided', async () => {
      const userId = 1;
      const searchParams = {};

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchUserDocuments(userId, searchParams);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('document.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should handle pagination correctly', async () => {
      const userId = 1;
      const searchParams = {
        page: 2,
        limit: 5
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 25])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchUserDocuments(userId, searchParams);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(result.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return a document by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument);

      const result = await service.findOne(mockDocument.id, mockUser.id, [UserRole.ADMIN]);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockDocument.id },
        relations: ['createdBy', 'updatedBy'],
      });
      expect(result).toEqual(mockDocument);
    });

    it('should throw NotFoundException if document not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, mockUser.id, [UserRole.ADMIN])).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user cannot access document', async () => {
      const privateDocument = { ...mockDocument, createdById: 999 };
      mockRepository.findOne.mockResolvedValue(privateDocument);

      await expect(service.findOne(mockDocument.id, mockUser.id, [UserRole.VIEWER])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update a document successfully', async () => {
      const updatedDocument = { ...mockDocument, ...mockUpdateDocumentDto };
      updatedDocument.updatedById = mockUser.id;

      mockRepository.findOne.mockResolvedValue(mockDocument);
      mockRepository.save.mockResolvedValue(updatedDocument);

      const result = await service.update(mockDocument.id, mockUpdateDocumentDto, mockUser.id, [UserRole.ADMIN]);

      expect(mockRepository.save).toHaveBeenCalledWith(updatedDocument);
      expect(result).toEqual(updatedDocument);
    });

    it('should update a document with file upload', async () => {
      const mockFile = {
        originalname: 'updated.pdf',
        buffer: Buffer.from('updated content'),
        size: 2048,
        mimetype: 'application/pdf',
      };
      const updatedDocument = { ...mockDocument, ...mockUpdateDocumentDto };
      updatedDocument.updatedById = mockUser.id;

      mockRepository.findOne.mockResolvedValue(mockDocument);
      mockRepository.save.mockResolvedValue(updatedDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const result = await service.update(mockDocument.id, mockUpdateDocumentDto, mockUser.id, [UserRole.ADMIN], mockFile);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(updatedDocument);
      expect(result).toEqual(updatedDocument);
    });

    it('should throw ForbiddenException if user cannot edit document', async () => {
      const privateDocument = { ...mockDocument, createdById: 999 };
      mockRepository.findOne.mockResolvedValue(privateDocument);

      await expect(service.update(mockDocument.id, mockUpdateDocumentDto, mockUser.id, [UserRole.VIEWER])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove a document successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument);
      mockRepository.remove.mockResolvedValue(mockDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

      await service.remove(mockDocument.id, mockUser.id, [UserRole.ADMIN]);

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockDocument.filePath);
      expect(mockRepository.remove).toHaveBeenCalledWith(mockDocument);
    });

    it('should throw ForbiddenException if user cannot delete document', async () => {
      const privateDocument = { ...mockDocument, createdById: 999 };
      mockRepository.findOne.mockResolvedValue(privateDocument);

      await expect(service.remove(mockDocument.id, mockUser.id, [UserRole.VIEWER])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('downloadFile', () => {
    it('should return file download info', async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.downloadFile(mockDocument.id, mockUser.id, [UserRole.ADMIN]);

      expect(result).toEqual({
        filePath: mockDocument.filePath,
        fileName: mockDocument.originalFileName,
      });
    });

    it('should throw NotFoundException if file does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(mockDocument);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.downloadFile(mockDocument.id, mockUser.id, [UserRole.ADMIN])).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllDocuments', () => {
    it('should return all documents for admin user', async () => {
      const documents = [mockDocument];
      mockRepository.find.mockResolvedValue(documents);

      const result = await service.findAllDocuments(mockUser.id, [UserRole.ADMIN]);

      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['createdBy', 'updatedBy'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(documents);
    });

    it('should return only user documents for regular user', async () => {
      const documents = [mockDocument];
      mockRepository.find.mockResolvedValue(documents);

      const result = await service.findAllDocuments(mockUser.id, [UserRole.EDITOR]);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { createdById: mockUser.id },
        relations: ['createdBy', 'updatedBy'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(documents);
    });
  });

  describe('searchAllDocuments', () => {
    it('should return paginated documents with search and filters for admin', async () => {
      const currentUserId = 1;
      const searchParams = {
        search: 'test',
        userId: 2,
        page: 1,
        limit: 10,
        sortBy: 'title',
        sortOrder: 'ASC' as const
      };

      const mockDocuments = [
        {
          id: 1,
          title: 'Test Document',
          description: 'Test description',
          content: 'Test content',
          status: 'published',
          filePath: '/path/to/file.pdf',
          createdById: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockDocuments, 1])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchAllDocuments(currentUserId, [UserRole.ADMIN], searchParams);

      expect(result).toEqual({
        documents: mockDocuments,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('document');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('document.createdBy', 'createdBy');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('document.updatedBy', 'updatedBy');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.createdById = :userId', { userId: 2 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(document.title ILIKE :search OR document.description ILIKE :search OR document.content ILIKE :search)',
        { search: '%test%' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.status = :status', { status: 'published' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.filePath IS NOT NULL');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('document.title', 'ASC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should return only user documents for regular user', async () => {
      const currentUserId = 1;
      const searchParams = {
        search: 'test',
        page: 1,
        limit: 5
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchAllDocuments(currentUserId, [UserRole.EDITOR], searchParams);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('document.createdById = :currentUserId', { currentUserId });
    });

    it('should allow regular user to filter by their own user ID', async () => {
      const currentUserId = 1;
      const searchParams = {
        userId: 1,
        page: 1,
        limit: 5
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchAllDocuments(currentUserId, [UserRole.EDITOR], searchParams);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('document.createdById = :userId', { userId: 1 });
    });

    it('should throw ForbiddenException when regular user tries to filter by other user ID', async () => {
      const currentUserId = 1;
      const searchParams = {
        userId: 2,
        page: 1,
        limit: 5
      };

      await expect(service.searchAllDocuments(currentUserId, [UserRole.EDITOR], searchParams))
        .rejects.toThrow(ForbiddenException);
    });

    it('should use default values when search params are not provided', async () => {
      const currentUserId = 1;
      const searchParams = {};

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0])
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchAllDocuments(currentUserId, [UserRole.ADMIN], searchParams);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('document.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });
}); 