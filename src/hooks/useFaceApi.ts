/**
 * Custom hook for face recognition API operations
 * Provides loading states, error handling, and caching
 */

import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  trainSingleStudent,
  trainBulkStudents,
  recognizeFaces,
  trainSectionModel,
  getModelStatus,
  checkApiHealth,
  FaceTrainingRequest,
  FaceTrainingResponse,
  BulkTrainingRequest,
  BulkTrainingResponse,
  FaceRecognitionRequest,
  FaceRecognitionResponse,
  TrainModelResponse,
  ModelStatusResponse,
} from "@/services/faceRecognitionApi";

interface UseFaceApiReturn {
  // API availability
  isApiAvailable: boolean;
  checkingApi: boolean;
  
  // Training operations
  trainStudent: (data: FaceTrainingRequest) => Promise<FaceTrainingResponse | null>;
  trainBulk: (data: BulkTrainingRequest) => Promise<BulkTrainingResponse | null>;
  trainModel: (sectionId: string) => Promise<TrainModelResponse | null>;
  
  // Recognition
  recognize: (data: FaceRecognitionRequest) => Promise<FaceRecognitionResponse | null>;
  
  // Model status
  modelStatus: ModelStatusResponse | null;
  fetchModelStatus: (sectionId: string) => Promise<void>;
  
  // Loading states
  isTraining: boolean;
  isRecognizing: boolean;
  isTrainingModel: boolean;
}

export function useFaceApi(): UseFaceApiReturn {
  const { toast } = useToast();
  
  const [isApiAvailable, setIsApiAvailable] = useState(false);
  const [checkingApi, setCheckingApi] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isTrainingModel, setIsTrainingModel] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);

  // Check API health on mount
  useEffect(() => {
    const checkHealth = async () => {
      setCheckingApi(true);
      const available = await checkApiHealth();
      setIsApiAvailable(available);
      setCheckingApi(false);
    };
    checkHealth();
  }, []);

  // Train single student
  const trainStudent = useCallback(async (data: FaceTrainingRequest): Promise<FaceTrainingResponse | null> => {
    setIsTraining(true);
    try {
      const result = await trainSingleStudent(data);
      
      if (result.success) {
        toast({
          title: "Training Complete",
          description: result.message,
        });
      } else {
        toast({
          title: "Training Failed",
          description: result.error || result.message,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: "Training Error",
        description: error.message || "Failed to train student face",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTraining(false);
    }
  }, [toast]);

  // Train bulk students
  const trainBulk = useCallback(async (data: BulkTrainingRequest): Promise<BulkTrainingResponse | null> => {
    setIsTraining(true);
    try {
      const result = await trainBulkStudents(data);
      
      toast({
        title: "Bulk Training Complete",
        description: `Trained ${result.trained}/${result.total} students successfully`,
        variant: result.failed > 0 ? "destructive" : "default",
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Bulk Training Error",
        description: error.message || "Failed to train students",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTraining(false);
    }
  }, [toast]);

  // Recognize faces
  const recognize = useCallback(async (data: FaceRecognitionRequest): Promise<FaceRecognitionResponse | null> => {
    setIsRecognizing(true);
    try {
      const result = await recognizeFaces(data);
      return result;
    } catch (error: any) {
      toast({
        title: "Recognition Error",
        description: error.message || "Failed to recognize faces",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsRecognizing(false);
    }
  }, [toast]);

  // Train section model
  const trainModel = useCallback(async (sectionId: string): Promise<TrainModelResponse | null> => {
    setIsTrainingModel(true);
    try {
      const result = await trainSectionModel(sectionId);
      
      if (result.success) {
        toast({
          title: "Model Training Complete",
          description: result.message,
        });
        // Refresh model status
        await fetchModelStatus(sectionId);
      } else {
        toast({
          title: "Model Training Failed",
          description: result.error || result.message,
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: "Model Training Error",
        description: error.message || "Failed to train model",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTrainingModel(false);
    }
  }, [toast]);

  // Fetch model status
  const fetchModelStatus = useCallback(async (sectionId: string): Promise<void> => {
    try {
      const status = await getModelStatus(sectionId);
      setModelStatus(status);
    } catch (error) {
      setModelStatus(null);
    }
  }, []);

  return {
    isApiAvailable,
    checkingApi,
    trainStudent,
    trainBulk,
    trainModel,
    recognize,
    modelStatus,
    fetchModelStatus,
    isTraining,
    isRecognizing,
    isTrainingModel,
  };
}
