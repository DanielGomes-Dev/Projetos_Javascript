import { HttpException, Injectable } from '@nestjs/common';
import { Course } from './entities/course.entity';

@Injectable()
export class CoursesService {
  private courses: Course[] = [
    {
      id: 1,
      name: 'Curso 01',
      description: 'Description Curso 01',
      tags: ['Tag 01', 'Tag 02'],
    },
    {
      id: 2,
      name: 'Curso 02',
      description: 'Description Curso 02',
      tags: ['Tag 01', 'Tag 02'],
    },
    {
      id: 3,
      name: 'Curso 03',
      description: 'Description Curso 03',
      tags: ['Tag 01', 'Tag 02'],
    },
  ];

  findAll() {
    const cursos = this.courses;
    if (!cursos) {
      throw new HttpException('Deu erro', 404);
    }
    return cursos;
  }

  findOne(id: string) {
    return this.courses.find((course) => course.id === Number(id));
  }

  create(createCourseDto) {
    this.courses.push(createCourseDto);
    return;
  }

  update(id, updateCourseDto) {
    const index = this.courses.findIndex((course) => course.id === Number(id));
    this.courses[index] = { ...this.courses[index], ...updateCourseDto };
  }

  remove(id) {
    const index = this.courses.findIndex((course) => course.id === Number(id));
    index >= 0 ? this.courses.splice(index, 1) : false;
    return;
  }
}
