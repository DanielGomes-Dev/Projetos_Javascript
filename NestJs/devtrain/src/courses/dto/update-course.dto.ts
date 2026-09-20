import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {} // Parte dos tipos

// export class UpdateCourseDto {
//   readonly name?: string;
//   readonly description?: string;
//   readonly tags?: string[];
// }

//Filtrar
