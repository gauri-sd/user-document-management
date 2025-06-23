import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/constants';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Create a new document with optional file upload' })
  @ApiResponse({
    status: 201,
    description: 'Document created successfully',
    type: DocumentResponseDto,
  })
  async create(
    @Body() createDocumentDto: CreateDocumentDto,
    @UploadedFile() file: any,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.documentsService.create(createDocumentDto, userId, file);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all documents with search and filters' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for title or description' })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Filter by user ID who created the document' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100, description: 'Number of items per page' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'title'], description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiResponse({
    status: 200,
    description: 'List of documents with pagination',
    schema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: { $ref: '#/components/schemas/DocumentResponseDto' }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  async findAll(
    @Query('search') search?: string,
    @Query('userId') userId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Request() req?: any,
  ) {
    const currentUserId = req.user.userId;
    const userRoles = req.user.roles;
    
    // If no search/filter parameters, return simple list
    if (search === undefined && userId === undefined && page === undefined && limit === undefined && sortBy === undefined && sortOrder === undefined) {
      const documents = await this.documentsService.findAllDocuments(currentUserId, userRoles);
      return {
        documents,
        total: documents.length,
        page: 1,
        limit: documents.length,
        totalPages: 1
      };
    }
    
    // If search/filter parameters provided, use search functionality
    const searchParams = {
      search,
      userId,
      page: page || 1,
      limit: limit || 10,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'DESC'
    };
    
    return this.documentsService.searchAllDocuments(currentUserId, userRoles, searchParams);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific document by ID' })
  @ApiResponse({
    status: 200,
    description: 'Document details',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.userId;
    const userRoles = req.user.roles;
    return this.documentsService.findOne(id, userId, userRoles);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update a document with optional file upload' })
  @ApiResponse({
    status: 200,
    description: 'Document updated successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @UploadedFile() file: any,
    @Request() req,
  ) {
    const userId = req.user.userId;
    const userRoles = req.user.roles;
    return this.documentsService.update(id, updateDocumentDto, userId, userRoles, file);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.userId;
    const userRoles = req.user.roles;
    return this.documentsService.remove(id, userId, userRoles);
  }

  @Get(':id/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download a document file' })
  @ApiResponse({ status: 200, description: 'File download' })
  @ApiResponse({ status: 404, description: 'Document or file not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;
    const userRoles = req.user.roles;
    const { filePath, fileName } = await this.documentsService.downloadFile(
      id,
      userId,
      userRoles,
    );

    res.download(filePath, fileName);
  }
}
