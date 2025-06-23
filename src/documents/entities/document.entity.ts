import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  originalFileName: string;

  @Column({ nullable: true })
  filePath: string;

  @Column({ nullable: true })
  fileSize: number;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: 'draft' })
  status: string; // draft, published, archived

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  createdBy: User;

  @Column()
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  updatedBy: User;

  @Column({ nullable: true })
  updatedById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}