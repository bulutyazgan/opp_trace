import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for attendee data
// In production, this would be replaced with a database
let storedAttendees: any[] = [];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate that we received attendee data
    if (!data.attendees || !Array.isArray(data.attendees)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected { attendees: [...] }' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Store the attendees with metadata
    storedAttendees = {
      attendees: data.attendees,
      eventUrl: data.eventUrl || '',
      timestamp: new Date().toISOString(),
      count: data.attendees.length
    } as any;

    console.log(`Received ${data.attendees.length} attendees from ${data.eventUrl || 'unknown event'}`);

    return NextResponse.json({
      success: true,
      message: `Successfully stored ${data.attendees.length} attendees`,
      count: data.attendees.length
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing attendee data:', error);
    return NextResponse.json(
      { error: 'Failed to process attendee data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  // Return stored attendees for the dashboard
  return NextResponse.json(storedAttendees || { attendees: [], count: 0 }, { headers: corsHeaders });
}
