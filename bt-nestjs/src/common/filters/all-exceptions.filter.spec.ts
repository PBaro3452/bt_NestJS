import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/orders' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('AllExceptionsFilter (BE-13)', () => {
  it('chuẩn hoá HttpException thành { statusCode, message, path, timestamp }', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = mockHost();

    filter.catch(new BadRequestException('Sai dữ liệu'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Sai dữ liệu');
    expect(body.path).toBe('/orders');
    expect(typeof body.timestamp).toBe('string');
  });

  it('lỗi không phải HttpException -> 500', () => {
    const filter = new AllExceptionsFilter();
    const { host, status } = mockHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
