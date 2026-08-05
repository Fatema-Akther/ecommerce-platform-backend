import { Body, Controller, Get, Header, Param, Post } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Get("tree")
  @Header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  @Header("Pragma", "no-cache")
  @Header("Expires", "0")
  tree() {
    return this.service.findTree();
  }

  @Get(":slug")
  bySlug(@Param("slug") slug: string) {
    return this.service.findOneBySlug(slug);
  }
}
