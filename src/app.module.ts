import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { DocumentsModule } from "./documents/documents.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { ProcessingModule } from "./processing/processing.module";
import { User } from "./users/entities/user.entity";
import { Document } from "./documents/entities/document.entity";
import { IngestionJob } from "./ingestion/entities/ingestion-job.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USER,
      // password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [User, Document, IngestionJob],
      synchronize: true,
      // ssl: {
      //   rejectUnauthorized: false
      // }
    }),
    AuthModule,
    UsersModule,
    DocumentsModule,
    IngestionModule,
    ProcessingModule,
  ],
})
export class AppModule {}