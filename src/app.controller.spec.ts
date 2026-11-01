// import { Test, TestingModule } from '@nestjs/testing';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';

// describe('AppController', () => {
//   let appController: AppController;

//   beforeEach(async () => {
//     const app: TestingModule = await Test.createTestingModule({
//       controllers: [AppController],
//       providers: [AppService],
//     }).compile();

//     appController = app.get<AppController>(AppController);
//   });

//   describe('root', () => {
//     it('should return "Hello World!"', () => {
//       expect(appController.getHello()).toBe('Hello World!');
//     });
//   });
// });






import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  describe('getRoot', () => {
    it('should return backend running status', () => {
      expect(appController.getRoot()).toEqual({
        status: 'ok',
        message: 'Backend is running',
      });
    });
  });

  describe('loaderVerify', () => {
    it('should return the correct Loader.io verification token', () => {
      expect(appController.loaderVerify()).toBe(
        'loaderio-530ca0d257a414fe480f51d61a11abd4',
      );
    });
  });
});
