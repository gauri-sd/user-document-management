import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum IngestionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export enum IngestionType {
  OCR = 'ocr',
  TEXT_EXTRACTION = 'text_extraction',
  DOCUMENT_CLASSIFICATION = 'document_classification',
  DATA_EXTRACTION = 'data_extraction'
}

@Entity('ingestion_jobs')
export class IngestionJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: IngestionType,
    default: IngestionType.OCR
  })
  type: IngestionType;

  @Column({
    type: 'enum',
    enum: IngestionStatus,
    default: IngestionStatus.PENDING
  })
  status: IngestionStatus;

  @Column({ type: 'int', default: 0 })
  progress: number; // 0-100 percentage

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'json', nullable: true })
  parameters: any; // Processing parameters

  @Column({ type: 'json', nullable: true })
  inputData: any; // Document IDs and metadata

  @Column({ type: 'json', nullable: true })
  outputData: any; // Results from processing

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalJobId: string; 

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column()
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 