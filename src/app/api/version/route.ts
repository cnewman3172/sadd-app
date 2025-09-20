import { NextResponse } from 'next/server';

export async function GET(){
  return NextResponse.json({
    name: process.env.npm_package_name || 'app',
    version: process.env.npm_package_version || '0.0.0',
    buildSha: process.env.BUILD_SHA || 'dev'
  });
}

