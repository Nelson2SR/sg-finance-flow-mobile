import axios from 'axios';
import { authService } from '../../services/authService';

jest.mock('axios');
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;


describe('authService TDD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully logs in and returns access token', async () => {
    const mockResponse = {
      data: { access_token: 'fake_token', token_type: 'bearer' }
    };
    mockedAxios.post.mockResolvedValue(mockResponse);

    const result = await authService.login('user', 'pass');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.any(FormData)
    );
    expect(result.access_token).toBe('fake_token');
  });

  it('successfully registers a new user', async () => {
    mockedAxios.post.mockResolvedValue({ data: { message: 'User created' } });

    const result = await authService.register('newuser', 'newpass');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      null,
      expect.objectContaining({
        params: { username: 'newuser', password: 'newpass' }
      })
    );
    expect(result.message).toBe('User created');
  });

  it('throws error on login failure', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Unauthorized'));

    await expect(authService.login('bad', 'pass')).rejects.toThrow('Unauthorized');
  });
});
