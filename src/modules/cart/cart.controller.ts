

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private service: CartService) {}

  @Post('add')
  add(
    @Request() req: any,
    @Body()
    body: {
      productId: string;
      quantity: number;
      variantId?: string;
      variantLabel?: string;
      image?: string;
      selectedOptionIds?: string[];
      selectedOptions?: Record<string, string>;
    },
  ) {
    return this.service.addToCart(
      req.user,
      body.productId,
      body.quantity,
      body.variantId,
      body.variantLabel,
      body.image,
      body.selectedOptionIds,
      body.selectedOptions,
    );
  }

  @Get()
  getMyCart(@Request() req: any) {
    return this.service.getMyCart(req.user);
  }

  @Patch('item/:itemId')
  updateQty(
    @Request() req: any,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
  ) {
    return this.service.updateItemQty(req.user, itemId, body.quantity);
  }

  @Delete('item/:itemId')
  remove(@Request() req: any, @Param('itemId') itemId: string) {
    return this.service.removeItem(req.user, itemId);
  }
}