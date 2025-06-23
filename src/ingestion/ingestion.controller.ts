import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import { TriggerIngestionDto } from './dto/trigger-ingestion.dto';
import { IngestionJobResponseDto } from './dto/ingestion-response.dto';
import { WebhookStatusUpdateDto } from './dto/webhook-status-update.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/constants';

@ApiTags('Ingestion')
@Controller('ingestion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  // Ingestion Trigger API
  @Post('trigger')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger a new ingestion job' })
  @ApiResponse({
    status: 201,
    description: 'Ingestion job triggered successfully',
    type: IngestionJobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 403, description: 'Access denied to documents' })
  async triggerIngestion(
    @Body() triggerDto: TriggerIngestionDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.ingestionService.triggerIngestion(triggerDto, userId);
  }

  // Ingestion Management API - Get all jobs
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all ingestion jobs for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100, description: 'Items per page' })
  @ApiResponse({
    status: 200,
    description: 'List of ingestion jobs with pagination',
    schema: {
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          items: { $ref: '#/components/schemas/IngestionJobResponseDto' }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    const userId = req.user.userId;
    return this.ingestionService.findAll(userId, page || 1, limit || 10);
  }

  // Ingestion Management API - Get specific job
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific ingestion job by ID' })
  @ApiResponse({
    status: 200,
    description: 'Ingestion job details',
    type: IngestionJobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.ingestionService.findOne(id, userId);
  }

  // Retry failed job
  @Post(':id/retry')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed ingestion job' })
  @ApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
    type: IngestionJobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  @ApiResponse({ status: 404, description: 'Ingestion job not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async retryJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.ingestionService.retryJob(id, userId);
  }

  // Webhook endpoint for external service to update job status
  @Post('webhook/status-update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Webhook endpoint for external service to update job status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Status updated successfully'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async updateJobStatus(
    @Body() statusUpdate: WebhookStatusUpdateDto,
  ) {
    await this.ingestionService.updateJobStatus(
      statusUpdate.externalJobId,
      {
        status: statusUpdate.status,
        progress: statusUpdate.progress,
        error: statusUpdate.error,
        output: statusUpdate.output,
      }
    );
    return { message: 'Status updated successfully' };
  }
} 