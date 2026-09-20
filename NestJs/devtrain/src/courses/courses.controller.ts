import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    this.coursesService.create(createCourseDto);
    return;
  }

  @Post('test')
  @HttpCode(204)
  create2(@Body('name') name, @Body('description') description) {
    return { name, description };
  }

  @Post('test2')
  @HttpCode(HttpStatus.NO_CONTENT)
  create3(@Body('name') name, @Body('description') description) {
    return { name, description };
  }

  @Post('test3')
  @HttpCode(HttpStatus.NO_CONTENT)
  create4(
    @Body('name') name,
    @Body('description') description,
    @Res() response,
  ) {
    // return response.status(200).send({ name, description });
    return response.status(200).json({ name, description });
  }

  @Get('list')
  findAllList() {
    return 'Listagem de Cursos/list';
  }

  @Get('list/test')
  findAllListTest() {
    return 'Listagem de Cursos/list';
  }

  @Get('list/:param')
  findAllWithParam(@Param() params) {
    return `Lsitagem ${params.param}`;
  }

  @Get('list/:test/test')
  findAllWithParamTest(@Param() { test }) {
    return `Lsitagem ${test}`;
  }

  @Get('list/:test2/test2')
  findAllWithParamTest2(@Param('test2') test2: string) {
    return `Lsitagem ${test2}2`;
  }

  @Get('list/:test2/test2/:test3')
  async findAllWithParamTest3(
    @Param('test2') test2: string,
    @Param('test3') test3: string,
  ) {
    return `Listagem ${test2 + ' ' + test3}2`;
  }

  @Put(':id')
  update(@Body() body: UpdateCourseDto, @Param() params) {
    return `Atualziando com Put ${body.name} ${params.id}`;
  }
  @Patch(':id')
  updateOne(@Body() body, @Param('id') id) {
    return `Atualziando com Patch ${body.name} ${id}`;
  }
  @Delete(':id')
  delete(@Body() body, @Param('id') id) {
    return `Deletando com Delete ${body.name} ${id}`;
  }
}
