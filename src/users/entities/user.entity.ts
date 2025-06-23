import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column('simple-array')
  roles: string[];

  @OneToMany(() => Document, document => document.createdBy)
  createdDocuments: Document[];

  @OneToMany(() => Document, document => document.updatedBy)
  updatedDocuments: Document[];
}