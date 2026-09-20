import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { TestController } from './test/test.controller';

@Module({
  imports: [UsersModule, CoursesModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {}
