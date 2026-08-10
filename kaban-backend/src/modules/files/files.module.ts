import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { File } from './models/file.model';

@Module({
  imports: [SequelizeModule.forFeature([File])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
