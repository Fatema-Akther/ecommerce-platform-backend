import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = this.repo.create({
      name: dto.name,
      slug: dto.slug,
      icon: dto.icon,
      isActive: dto.isActive ?? true,
    });

    if (dto.parentId) {
      const parent = await this.repo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException('Invalid parentId');
      category.parent = parent;
    }

    return this.repo.save(category);
  }

  async findTree() {
    const roots = await this.repo.find({
      where: { parent: IsNull(), isActive: true },
      relations: { children: true },
      order: { name: 'ASC' },
    });
    return roots;
  }

  async findOneBySlug(slug: string) {
    const cat = await this.repo.findOne({
      where: { slug },
      relations: { parent: true, children: true },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }
}
