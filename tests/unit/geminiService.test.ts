import * as FileSystem from 'expo-file-system';
import { scanDocumentWithGemini } from '../../services/geminiService';
import { GoogleGenerativeAI } from "@google/generative-ai";

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64'
  }
}));

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockImplementation(() => ({
        generateContent: mockGenerateContent
      }))
    }))
  };
});

describe('geminiService TDD', () => {
  const mockUri = 'file://test.pdf';
  const mockMimeType = 'application/pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully scans a document and returns parsed JSON', async () => {
    const mockBase64 = 'mock_base64_data';
    const mockJsonResponse = {
      sourceType: 'ESTATEMENT',
      transactions: [
        { merchant: 'Test Merchant', amount: 100, date: '2024-01-01', category: 'Dining', type: 'EXPENSE', currency: 'SGD' }
      ]
    };

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
    
    // Mocking Gemini response structure
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI();
    const model = genAI.getGenerativeModel();
    (model.generateContent as jest.Mock).mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockJsonResponse)
      }
    });

    const result = await scanDocumentWithGemini(mockUri, mockMimeType);

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(mockUri, expect.objectContaining({
      encoding: 'base64'
    }));
    
    // Check that amount was converted to number and category is present
    expect(result?.transactions[0].amount).toBe(100);
    expect(result?.transactions[0].category).toBe('Dining');
    expect(result).toEqual(expect.objectContaining({
      sourceType: 'ESTATEMENT'
    }));
  });

  it('provides safe defaults for missing data', async () => {
    const mockBase64 = 'mock_base64_data';
    const mockIncompleteResponse = {
      transactions: [
        { merchant: 'Minimal Tx', amount: "50" } // missing date, category, type
      ]
    };

    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(mockBase64);
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI();
    const model = genAI.getGenerativeModel();
    (model.generateContent as jest.Mock).mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockIncompleteResponse)
      }
    });

    const result = await scanDocumentWithGemini(mockUri, mockMimeType);

    expect(result?.transactions[0].merchant).toBe('Minimal Tx');
    expect(result?.transactions[0].category).toBe('Other');
    expect(result?.transactions[0].type).toBe('EXPENSE');
    expect(result?.transactions[0].amount).toBe(50);
  });


  it('handles errors and returns null', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

    const result = await scanDocumentWithGemini(mockUri, mockMimeType);

    expect(result).toBeNull();
  });
});
