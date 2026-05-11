import * as FileSystem from 'expo-file-system/legacy';
import { scanDocumentWithGemini } from '../../services/geminiService';

// Mock FileSystem
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64'
  }
}));

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}));

export { mockGenerateContent, mockGetGenerativeModel };

describe('Gemini Service TDD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('scanDocumentWithGemini should call FileSystem.readAsStringAsync with Base64 encoding', async () => {
    const uri = 'file:///test.jpg';
    const mimeType = 'image/jpeg';
    
    // Simulate the error where EncodingType might be undefined in some environments
    // or if the import is causing issues. 
    // Actually, in TDD we want to see it fail if the code is wrong.
    
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ sourceType: 'RECEIPT', transactions: [] })
      }
    });
    
    await scanDocumentWithGemini(uri, mimeType);
    
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(uri, {
      encoding: FileSystem.EncodingType.Base64
    });
  });

  test('scanDocumentWithGemini should return null if Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => "This is not JSON"
      }
    });

    const result = await scanDocumentWithGemini('test', 'image/jpeg');
    expect(result).toBeNull();
  });

  test('scanDocumentWithGemini should extract JSON correctly even with surrounding text', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => "Some preamble here... ```json\n{\"sourceType\": \"RECEIPT\", \"transactions\": []}\n``` and postamble."
      }
    });

    const result = await scanDocumentWithGemini('test', 'image/jpeg');
    expect(result).not.toBeNull();
    expect(result?.sourceType).toBe('RECEIPT');
  });

  test('scanDocumentWithGemini should return null if FileSystem.readAsStringAsync fails', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('File not found'));

    const result = await scanDocumentWithGemini('test', 'image/jpeg');
    expect(result).toBeNull();
  });

  test('scanDocumentWithGemini should return null if Gemini API throws an error', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API Key Invalid'));

    const result = await scanDocumentWithGemini('test', 'image/jpeg');
    expect(result).toBeNull();
  });

  test('scanDocumentWithGemini should handle partially malformed transaction data with defaults', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ 
          sourceType: 'RECEIPT', 
          transactions: [
            { merchant: 'Valid', amount: 10, date: '2024-01-01', category: 'Dining', type: 'EXPENSE', currency: 'SGD' },
            { merchant: '', amount: null, date: null, category: null, type: null, currency: null } 
          ] 
        })
      }
    });

    const result = await scanDocumentWithGemini('test', 'image/jpeg');
    expect(result).not.toBeNull();
    expect(result?.transactions.length).toBe(2);
    expect(result?.transactions[1].merchant).toBe('Unknown Merchant');
    expect(result?.transactions[1].amount).toBe(0);
    expect(result?.transactions[1].category).toBe('Other');
  });
});
