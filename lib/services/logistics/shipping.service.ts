// Servicio de lógica de negocio para logística y envíos

import { LogisticsRepository } from '@/lib/repositories/logistics.repository';
import { StorageService } from '@/lib/services/storage/storage.service';
import { LogisticsOrder } from '@/lib/repositories/logistics.repository';
import { ValidationError, NotFoundError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';

export interface UploadLabelParams {
  orderId: string;
  file: File;
  uploadedBy: string;
}

export interface UpdateTrackingParams {
  orderId: string;
  trackingNumber: string;
  carrier: string;
}

export class ShippingService {
  constructor(
    private logisticsRepo: LogisticsRepository,
    private storageService: StorageService
  ) {}

  /**
   * Subir guía de envío (PDF) para una orden
   */
  async uploadShippingLabel(params: UploadLabelParams): Promise<{ order: LogisticsOrder; url: string }> {
    const { orderId, file, uploadedBy } = params;

    // Validaciones
    validateRequired(orderId, 'orderId');
    validateRequired(uploadedBy, 'uploadedBy');
    if (!validateUUID(orderId)) {
      throw new ValidationError('orderId debe ser un UUID válido');
    }

    if (!file || file.size === 0) {
      throw new ValidationError('El archivo está vacío');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new ValidationError('El PDF es demasiado grande (máx 15MB)');
    }

    // Verificar que la orden existe
    const order = await this.logisticsRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    // Subir archivo a storage
    const { url } = await this.storageService.uploadShippingLabel(orderId, file);

    // Actualizar orden con la URL de la guía
    const updatedOrder = await this.logisticsRepo.updateShippingLabel(orderId, url, uploadedBy);

    return { order: updatedOrder, url };
  }

  /**
   * Actualizar tracking y carrier de una orden
   */
  async updateTracking(params: UpdateTrackingParams): Promise<LogisticsOrder> {
    const { orderId, trackingNumber, carrier } = params;

    validateRequired(orderId, 'orderId');
    validateRequired(trackingNumber, 'trackingNumber');
    validateRequired(carrier, 'carrier');

    const order = await this.logisticsRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    return await this.logisticsRepo.updateTracking(orderId, trackingNumber, carrier);
  }

  /**
   * Obtener órdenes de logística
   */
  async getLogisticsOrders(status?: string, limit: number = 200): Promise<LogisticsOrder[]> {
    return this.logisticsRepo.findLogisticsOrders(status, limit);
  }
}
