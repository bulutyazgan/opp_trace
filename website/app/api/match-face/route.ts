import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { dataStore } from '@/lib/dataStore';

interface MatchFaceRequest {
  imageData: string; // base64 encoded image
}

interface MatchFaceResponse {
  success: boolean;
  match?: {
    profile: any;
    confidence: number;
    distance: number;
    verified: boolean;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MatchFaceRequest = await request.json();
    const { imageData } = body;

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      );
    }

    // Get current attendees from the shared data store
    const data = dataStore.getData();
    const attendees = data.attendees || [];

    // Filter attendees that have LinkedIn profile photos
    const attendeesWithPhotos = attendees.filter(
      (a: any) => a.linkedinData && a.linkedinData.profile_photo
    );

    if (attendeesWithPhotos.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No attendees with LinkedIn profile photos found. Please run LinkedIn scraping first.'
        },
        { status: 400 }
      );
    }

    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Write attendees data to temporary JSON file
    const attendeesJsonPath = join(tempDir, `attendees_${Date.now()}.json`);
    writeFileSync(
      attendeesJsonPath,
      JSON.stringify({ attendees: attendeesWithPhotos }, null, 2)
    );

    // Run Python face recognition script
    const pythonScriptPath = join(process.cwd(), 'lib', 'faceRecognitionService.py');

    const result = await runPythonFaceRecognition(
      pythonScriptPath,
      imageData,
      attendeesJsonPath
    );

    // Clean up temporary JSON file
    try {
      unlinkSync(attendeesJsonPath);
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in match-face API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * Run Python face recognition script as a subprocess
 */
function runPythonFaceRecognition(
  scriptPath: string,
  base64Image: string,
  attendeesJsonPath: string
): Promise<MatchFaceResponse> {
  return new Promise((resolve, reject) => {
    // Use the virtual environment Python if it exists
    const venvPython = join(process.cwd(), '..', '.venv', 'bin', 'python3');
    const pythonCommand = venvPython; // Use venv Python

    // Spawn Python process
    const pythonProcess = spawn(pythonCommand, [
      scriptPath,
      base64Image,
      attendeesJsonPath
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script stderr:', stderr);
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse JSON output from Python script
        // Clean up stdout: trim whitespace and extract JSON (handle potential extra output)
        let jsonString = stdout.trim();

        // If there's extra output, try to find the JSON object
        const jsonStart = jsonString.indexOf('{');
        const jsonEnd = jsonString.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
        }

        const result: MatchFaceResponse = JSON.parse(jsonString);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', stdout);
        console.error('Python stderr:', stderr);
        console.error('Parse error details:', parseError);
        reject(new Error('Failed to parse face recognition results'));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Error spawning Python process:', error);
      reject(new Error('Failed to run face recognition: ' + error.message));
    });

    // Set timeout (200 seconds - increased to allow for image downloads)
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Face recognition timeout - processing took longer than 200 seconds'));
    }, 20000000);
  });
}

// Enable CORS for local development
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
