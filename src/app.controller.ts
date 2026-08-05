// import { Controller, Get } from '@nestjs/common';

// @Controller()
// export class AppController {
//   @Get()
//   getRoot() {
//     return {
//       status: 'ok',
//       message: 'Backend is running',
//     };
//   }
// }


import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      message: 'Backend is running',
    };
  }

  // Loader.io verification route
  @Get('loaderio-530ca0d257a414fe480f51d61a11abd4.txt')
  loaderVerify() {
    return 'loaderio-530ca0d257a414fe480f51d61a11abd4';
  }
}