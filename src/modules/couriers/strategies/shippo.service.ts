import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import { CourierStrategy } from './courier.strategy';
import { resolveCourierConfig } from '../utils/courier-config.util';
import { CourierProvider } from '../courier-provider.entity';
import { Order } from 'src/modules/orders/order.entity';
import { OrderShipment } from '../order-shipment.entity';


@Injectable()
export class ShippoService implements CourierStrategy {


  private buildShipmentPayload(
    order: any,
    pickupAddress?: string,
  ) {


    return {

      address_from: {

        name:
          process.env.BUSINESS_NAME ||
          'My Store',

        street1:
          pickupAddress ||
          process.env.BUSINESS_ADDRESS,

        city:
          process.env.BUSINESS_CITY ||
          'San Francisco',

        state:
          process.env.BUSINESS_STATE ||
          'CA',

        zip:
          process.env.BUSINESS_ZIP ||
          '94105',

        country:
          process.env.BUSINESS_COUNTRY ||
          'US',

        phone:
 process.env.BUSINESS_PHONE?.trim() || undefined,

        email:
          process.env.BUSINESS_EMAIL,

      },


      address_to: {

        name:
          order.delivery.fullName,

        street1:
          order.delivery.address,

        city:
          order.delivery.city,

        state:
          order.delivery.state,

        zip:
          order.delivery.postalCode,

        country:
          order.delivery.country,

      phone:
 order.delivery.phone?.trim() || undefined,

      },


      parcels: [

        {

          length:
            order.parcel?.length ||
            '30',

          width:
            order.parcel?.width ||
            '25',

          height:
            order.parcel?.height ||
            '5',

          distance_unit:
            'cm',

          weight:
 this.calculateTotalWeight(order.items),

          mass_unit:
            'kg',

        },

      ],


      metadata:
        order.id
          ? `Order ID: ${order.id}`
          : undefined,

    };

  }


private calculateTotalWeight(items: any[]) {


  

  const DEFAULT_WEIGHT = 0.4;


 

  return items.reduce(
    (total, item) => {

      const weight =
        Number(
          item.product?.weight ??
          DEFAULT_WEIGHT
        );



      return total +
        (weight * Number(item.quantity ?? 1));

    },
    0,
  ).toFixed(2);

}


  private async createShippoShipment(
    payload: any,
    provider: CourierProvider,
  ) {


    if (!provider.apiConfig?.keyRef) {

      throw new BadRequestException(
        'Missing API config',
      );

    }



    const config =
      resolveCourierConfig(
        provider.apiConfig.keyRef,
      );



    const res =
      await fetch(
        `${config.baseUrl}/shipments/`,
        {

          method:'POST',

          headers:{

            Authorization:
              `ShippoToken ${config.apiKey}`,

            'Content-Type':
              'application/json',

          },


          body:
            JSON.stringify(payload),

        },
      );



    if (!res.ok) {


      const text =
        await res.text();


      throw new BadRequestException(
        `Shippo API error: ${res.status} - ${text}`,
      );

    }



    return res.json();

  }

private async getCarrierAccounts(
  provider: CourierProvider,
) {

  if (!provider.apiConfig?.keyRef) {
    throw new BadRequestException(
      'Missing Shippo API config',
    );
  }


  const config =
    resolveCourierConfig(
      provider.apiConfig.keyRef,
    );


  const res =
    await fetch(
      `${config.baseUrl}/carrier_accounts/`,
      {
        method: 'GET',

        headers: {
          Authorization:
            `ShippoToken ${config.apiKey}`,
        },
      },
    );


  if (!res.ok) {

    const error =
      await res.text();

    throw new BadRequestException(
      `Unable to fetch Shippo carrier accounts: ${error}`,
    );
  }


  return res.json();

}



  async createShipment(
    order: Order,
    provider: CourierProvider,
    options?: {
      pickupAddress?: string;
    },
  ) {



    const pickupAddress =
      options?.pickupAddress?.trim();



    if (!pickupAddress) {

      throw new BadRequestException(
        'Pickup address is required',
      );

    }



    const payload =
      this.buildShipmentPayload(
        order,
        pickupAddress,
      );



    const data =
      await this.createShippoShipment(
        payload,
        provider,
      );



    return {


      rates:
        data.rates,


      rawResponse: {

        shipment:
          data,

      },

    };

  }







  async getShippingRates(
    orderData:any,
    provider:CourierProvider,
  ) {


    const payload =
      this.buildShipmentPayload(
        orderData,
      );



    const data =
      await this.createShippoShipment(
        payload,
        provider,
      );



    // return {


    //   rates:

    //     data.rates.map(
    //       (rate:any)=>({

    //         id:
    //           rate.object_id,


    //         provider:
    //           rate.provider,


    //         service:
    //           rate.servicelevel?.name ||
    //           rate.servicelevel?.token,


    //         amount:
    //           rate.amount,


    //         currency:
    //           rate.currency,


    //         estimated_days:
    //           rate.estimated_days,

    //       }),
    //     ),



    //   rawResponse:
    //     data,

    // };


const availableRates =
  data.rates.filter(
    (rate:any)=> {

      if (!rate.carrier_account) {
        return false;
      }

      if (
        rate.messages &&
        rate.messages.length
      ) {
        return false;
      }

      return true;
    },
  );


return {

 rates:
  availableRates.map(
    (rate:any)=>({

      id: rate.object_id,

      provider:
        rate.provider,

      service:
        rate.servicelevel?.name ||
        rate.servicelevel?.token,

      amount:
        rate.amount,

      currency:
        rate.currency,

      estimated_days:
        rate.estimated_days,

      carrierAccount:
        rate.carrier_account,


    rawResponse:{
  address_from: payload.address_from,

  address_to: payload.address_to,

  parcels: payload.parcels,

  rate,
},

    }),
  ),


  rawResponse: {
    transaction: data,

    address_from:
      payload.address_from,

    address_to:
      payload.address_to,
  },

};
  }









  async createLabel(
    shipment: OrderShipment,
    rateId:string,
  ) {



    const provider =
      shipment.courierProvider;



    if (!provider?.apiConfig?.keyRef) {


      throw new BadRequestException(
        'Missing API config',
      );

    }



    const config =
      resolveCourierConfig(
        provider.apiConfig.keyRef,
      );



    const payload = {


      rate:
        rateId,


      label_file_type:
        'PDF',


      async:
        false,

    };



    const res =
      await fetch(
        `${config.baseUrl}/transactions/`,
        {


          method:'POST',


          headers:{


            Authorization:
              `ShippoToken ${config.apiKey}`,


            'Content-Type':
              'application/json',

          },


          body:
            JSON.stringify(payload),

        },
      );



    if (!res.ok) {

  let error: any;

  try {
    error = await res.json();
  } catch {
    error = await res.text();
  }

  // console.log(
  //   "SHIPPO LABEL ERROR",
  //   error,
  // );

  throw new BadRequestException({
    message: "SHIPPO LABEL ERROR",
    details: error,
  });

}


   const data = await res.json();


if (
  data.status === "ERROR" ||
  data.object_state === "INVALID" ||
  data.messages?.length
) {

  throw new BadRequestException({
    message: "SHIPPO LABEL ERROR",
    details: data.messages,
  });

}


return {

  trackingNumber:
    data.tracking_number,

  labelUrl:
    data.label_url,

  trackingUrl:
    data.tracking_url_provider,

  transactionId:
    data.object_id,

  rawResponse:
    data,

};

  }


}