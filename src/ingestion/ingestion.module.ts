import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { IngestionJob } from './entities/ingestion-job.entity';
import { Document } from '../documents/entities/document.entity';
import { ProcessingModule } from '../processing/processing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngestionJob, Document]),
    ProcessingModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}