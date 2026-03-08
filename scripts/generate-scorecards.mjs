#!/usr/bin/env node
/**
 * Generate branded HTML scorecards for all courses.
 * Run: node scripts/generate-scorecards.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── Course data (mirrors lib/courses/data.ts) ──────────────────────
function buildTees(cr, slope) {
  return [
    { colour: "yellow", cr: +(cr - 1.5).toFixed(1), slope: slope - 6 },
    { colour: "white", cr, slope },
    { colour: "blue", cr: +(cr + 1.5).toFixed(1), slope: slope + 8 },
    { colour: "red", cr: +(cr - 3.5).toFixed(1), slope: slope - 10 },
  ];
}

const RAW = [
  { id: "royal-jhb-east", name: "Royal Johannesburg & Kensington (East)", city: "Johannesburg", province: "Gauteng", par: 72, rating: 74.2, slope: 137, holes: [{ hole:1,par:4,si:7},{hole:2,par:4,si:1},{hole:3,par:3,si:15},{hole:4,par:5,si:9},{hole:5,par:4,si:3},{hole:6,par:4,si:11},{hole:7,par:3,si:17},{hole:8,par:5,si:5},{hole:9,par:4,si:13},{hole:10,par:4,si:2},{hole:11,par:4,si:6},{hole:12,par:3,si:18},{hole:13,par:5,si:10},{hole:14,par:4,si:4},{hole:15,par:4,si:8},{hole:16,par:3,si:16},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "glendower", name: "Glendower Golf Club", city: "Edenvale", province: "Gauteng", par: 72, rating: 73.1, slope: 132, holes: [{hole:1,par:4,si:9},{hole:2,par:5,si:3},{hole:3,par:4,si:13},{hole:4,par:3,si:17},{hole:5,par:4,si:1},{hole:6,par:4,si:7},{hole:7,par:5,si:11},{hole:8,par:3,si:15},{hole:9,par:4,si:5},{hole:10,par:4,si:6},{hole:11,par:4,si:2},{hole:12,par:3,si:16},{hole:13,par:5,si:10},{hole:14,par:4,si:4},{hole:15,par:4,si:8},{hole:16,par:3,si:18},{hole:17,par:5,si:14},{hole:18,par:4,si:12}] },
  { id: "randpark-bushwillow", name: "Randpark Golf Club (Bushwillow)", city: "Randburg", province: "Gauteng", par: 72, rating: 72.5, slope: 129, holes: [{hole:1,par:4,si:11},{hole:2,par:3,si:15},{hole:3,par:5,si:5},{hole:4,par:4,si:1},{hole:5,par:4,si:9},{hole:6,par:4,si:7},{hole:7,par:3,si:17},{hole:8,par:5,si:3},{hole:9,par:4,si:13},{hole:10,par:4,si:2},{hole:11,par:5,si:6},{hole:12,par:4,si:10},{hole:13,par:3,si:18},{hole:14,par:4,si:4},{hole:15,par:5,si:8},{hole:16,par:4,si:12},{hole:17,par:3,si:16},{hole:18,par:4,si:14}] },
  { id: "wanderers", name: "Wanderers Golf Club", city: "Johannesburg", province: "Gauteng", par: 72, rating: 73.8, slope: 134, holes: [{hole:1,par:4,si:5},{hole:2,par:5,si:1},{hole:3,par:4,si:11},{hole:4,par:3,si:17},{hole:5,par:4,si:7},{hole:6,par:4,si:3},{hole:7,par:5,si:9},{hole:8,par:3,si:15},{hole:9,par:4,si:13},{hole:10,par:4,si:4},{hole:11,par:4,si:8},{hole:12,par:3,si:16},{hole:13,par:5,si:2},{hole:14,par:4,si:10},{hole:15,par:4,si:6},{hole:16,par:3,si:18},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "centurion-cc", name: "Centurion Country Club", city: "Centurion", province: "Gauteng", par: 72, rating: 72.0, slope: 128, holes: [{hole:1,par:4,si:8},{hole:2,par:5,si:4},{hole:3,par:4,si:12},{hole:4,par:3,si:16},{hole:5,par:4,si:2},{hole:6,par:4,si:6},{hole:7,par:5,si:10},{hole:8,par:3,si:18},{hole:9,par:4,si:14},{hole:10,par:4,si:1},{hole:11,par:4,si:5},{hole:12,par:3,si:17},{hole:13,par:5,si:9},{hole:14,par:4,si:3},{hole:15,par:4,si:7},{hole:16,par:3,si:15},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "serengeti", name: "Serengeti Golf & Wildlife Estate", city: "Kempton Park", province: "Gauteng", par: 72, rating: 74.5, slope: 139, holes: [{hole:1,par:4,si:10},{hole:2,par:4,si:2},{hole:3,par:5,si:6},{hole:4,par:3,si:14},{hole:5,par:4,si:4},{hole:6,par:4,si:8},{hole:7,par:3,si:18},{hole:8,par:5,si:12},{hole:9,par:4,si:16},{hole:10,par:4,si:1},{hole:11,par:4,si:7},{hole:12,par:3,si:15},{hole:13,par:5,si:5},{hole:14,par:4,si:3},{hole:15,par:4,si:9},{hole:16,par:3,si:17},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "durban-cc", name: "Durban Country Club", city: "Durban", province: "KwaZulu-Natal", par: 72, rating: 74.8, slope: 140, holes: [{hole:1,par:4,si:3},{hole:2,par:4,si:9},{hole:3,par:5,si:1},{hole:4,par:3,si:13},{hole:5,par:4,si:7},{hole:6,par:4,si:5},{hole:7,par:3,si:17},{hole:8,par:5,si:11},{hole:9,par:4,si:15},{hole:10,par:4,si:2},{hole:11,par:5,si:4},{hole:12,par:4,si:8},{hole:13,par:3,si:18},{hole:14,par:4,si:6},{hole:15,par:5,si:10},{hole:16,par:4,si:12},{hole:17,par:3,si:16},{hole:18,par:4,si:14}] },
  { id: "zimbali", name: "Zimbali Country Club", city: "Ballito", province: "KwaZulu-Natal", par: 72, rating: 73.6, slope: 135, holes: [{hole:1,par:5,si:5},{hole:2,par:4,si:1},{hole:3,par:4,si:9},{hole:4,par:3,si:15},{hole:5,par:4,si:3},{hole:6,par:4,si:11},{hole:7,par:5,si:7},{hole:8,par:3,si:17},{hole:9,par:4,si:13},{hole:10,par:4,si:4},{hole:11,par:4,si:2},{hole:12,par:3,si:16},{hole:13,par:5,si:6},{hole:14,par:4,si:8},{hole:15,par:4,si:10},{hole:16,par:3,si:18},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "gary-player-sun-city", name: "Sun City – Gary Player Country Club", city: "Sun City", province: "North West", par: 72, rating: 76.1, slope: 144, holes: [{hole:1,par:4,si:4},{hole:2,par:5,si:2},{hole:3,par:4,si:10},{hole:4,par:3,si:16},{hole:5,par:4,si:6},{hole:6,par:4,si:8},{hole:7,par:5,si:12},{hole:8,par:3,si:18},{hole:9,par:4,si:14},{hole:10,par:4,si:1},{hole:11,par:4,si:5},{hole:12,par:3,si:17},{hole:13,par:5,si:9},{hole:14,par:4,si:3},{hole:15,par:4,si:7},{hole:16,par:3,si:15},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "fancourt-montagu", name: "Fancourt (Montagu)", city: "George", province: "Western Cape", par: 72, rating: 75.3, slope: 141, holes: [{hole:1,par:4,si:6},{hole:2,par:4,si:2},{hole:3,par:5,si:8},{hole:4,par:3,si:14},{hole:5,par:4,si:4},{hole:6,par:4,si:10},{hole:7,par:3,si:18},{hole:8,par:5,si:12},{hole:9,par:4,si:16},{hole:10,par:4,si:1},{hole:11,par:4,si:7},{hole:12,par:3,si:15},{hole:13,par:5,si:5},{hole:14,par:4,si:3},{hole:15,par:4,si:9},{hole:16,par:3,si:17},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "pearl-valley", name: "Pearl Valley Golf Estates", city: "Paarl", province: "Western Cape", par: 72, rating: 73.9, slope: 136, holes: [{hole:1,par:4,si:7},{hole:2,par:5,si:3},{hole:3,par:4,si:11},{hole:4,par:3,si:15},{hole:5,par:4,si:1},{hole:6,par:4,si:9},{hole:7,par:5,si:5},{hole:8,par:3,si:17},{hole:9,par:4,si:13},{hole:10,par:4,si:4},{hole:11,par:4,si:2},{hole:12,par:3,si:16},{hole:13,par:5,si:6},{hole:14,par:4,si:8},{hole:15,par:4,si:10},{hole:16,par:3,si:18},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "westlake", name: "Westlake Golf Club", city: "Cape Town", province: "Western Cape", par: 72, rating: 71.8, slope: 127, holes: [{hole:1,par:4,si:9},{hole:2,par:4,si:3},{hole:3,par:3,si:13},{hole:4,par:5,si:1},{hole:5,par:4,si:7},{hole:6,par:4,si:5},{hole:7,par:3,si:17},{hole:8,par:5,si:11},{hole:9,par:4,si:15},{hole:10,par:4,si:2},{hole:11,par:5,si:4},{hole:12,par:4,si:10},{hole:13,par:3,si:18},{hole:14,par:4,si:6},{hole:15,par:5,si:8},{hole:16,par:4,si:12},{hole:17,par:3,si:16},{hole:18,par:4,si:14}] },
  { id: "leopard-creek", name: "Leopard Creek Country Club", city: "Malelane", province: "Mpumalanga", par: 72, rating: 75.8, slope: 142, holes: [{hole:1,par:4,si:5},{hole:2,par:4,si:1},{hole:3,par:5,si:7},{hole:4,par:3,si:15},{hole:5,par:4,si:3},{hole:6,par:4,si:11},{hole:7,par:5,si:9},{hole:8,par:3,si:17},{hole:9,par:4,si:13},{hole:10,par:4,si:2},{hole:11,par:4,si:6},{hole:12,par:3,si:18},{hole:13,par:5,si:4},{hole:14,par:4,si:8},{hole:15,par:4,si:10},{hole:16,par:3,si:16},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "humewood", name: "Humewood Golf Club", city: "Port Elizabeth", province: "Eastern Cape", par: 72, rating: 73.4, slope: 133, holes: [{hole:1,par:4,si:8},{hole:2,par:5,si:4},{hole:3,par:4,si:12},{hole:4,par:3,si:16},{hole:5,par:4,si:2},{hole:6,par:4,si:6},{hole:7,par:5,si:10},{hole:8,par:3,si:18},{hole:9,par:4,si:14},{hole:10,par:4,si:1},{hole:11,par:4,si:7},{hole:12,par:3,si:15},{hole:13,par:5,si:5},{hole:14,par:4,si:3},{hole:15,par:4,si:9},{hole:16,par:3,si:17},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "selborne", name: "Selborne Golf Estate", city: "Pennington", province: "KwaZulu-Natal", par: 72, rating: 72.8, slope: 130, holes: [{hole:1,par:4,si:6},{hole:2,par:4,si:2},{hole:3,par:5,si:8},{hole:4,par:3,si:14},{hole:5,par:4,si:4},{hole:6,par:4,si:10},{hole:7,par:3,si:18},{hole:8,par:5,si:12},{hole:9,par:4,si:16},{hole:10,par:4,si:1},{hole:11,par:4,si:7},{hole:12,par:3,si:15},{hole:13,par:5,si:3},{hole:14,par:4,si:9},{hole:15,par:4,si:5},{hole:16,par:3,si:17},{hole:17,par:5,si:11},{hole:18,par:4,si:13}] },
  { id: "cmr-golf-club", name: "CMR Golf Club", city: "Roodepoort", province: "Gauteng", par: 72, rating: 71.5, slope: 125, holes: [{hole:1,par:5,si:9},{hole:2,par:4,si:5},{hole:3,par:4,si:1},{hole:4,par:5,si:13},{hole:5,par:5,si:3},{hole:6,par:3,si:11},{hole:7,par:4,si:7},{hole:8,par:3,si:17},{hole:9,par:4,si:15},{hole:10,par:4,si:8},{hole:11,par:4,si:4},{hole:12,par:4,si:6},{hole:13,par:4,si:2},{hole:14,par:3,si:18},{hole:15,par:4,si:10},{hole:16,par:4,si:16},{hole:17,par:3,si:14},{hole:18,par:5,si:12}] },
  { id: "observatory", name: "Observatory Golf Club", city: "Johannesburg", province: "Gauteng", par: 72, rating: 73.4, slope: 135, holes: [{hole:1,par:4,si:4},{hole:2,par:5,si:18},{hole:3,par:4,si:2},{hole:4,par:3,si:8},{hole:5,par:4,si:12},{hole:6,par:4,si:6},{hole:7,par:5,si:16},{hole:8,par:3,si:10},{hole:9,par:5,si:14},{hole:10,par:4,si:1},{hole:11,par:3,si:13},{hole:12,par:4,si:7},{hole:13,par:4,si:5},{hole:14,par:5,si:17},{hole:15,par:3,si:11},{hole:16,par:4,si:15},{hole:17,par:4,si:3},{hole:18,par:4,si:9}] },
  { id: "houghton", name: "Houghton Golf Club", city: "Johannesburg", province: "Gauteng", par: 72, rating: 73.5, slope: 133, holes: [{hole:1,par:4,si:10},{hole:2,par:4,si:2},{hole:3,par:5,si:18},{hole:4,par:4,si:4},{hole:5,par:5,si:16},{hole:6,par:4,si:8},{hole:7,par:3,si:14},{hole:8,par:4,si:6},{hole:9,par:3,si:12},{hole:10,par:5,si:15},{hole:11,par:4,si:5},{hole:12,par:4,si:1},{hole:13,par:4,si:13},{hole:14,par:3,si:17},{hole:15,par:5,si:9},{hole:16,par:3,si:7},{hole:17,par:4,si:11},{hole:18,par:4,si:3}] },
  { id: "parkview", name: "Parkview Golf Club", city: "Johannesburg", province: "Gauteng", par: 72, rating: 72.0, slope: 130, holes: [{hole:1,par:5,si:17},{hole:2,par:4,si:7},{hole:3,par:3,si:11},{hole:4,par:4,si:1},{hole:5,par:3,si:15},{hole:6,par:4,si:13},{hole:7,par:4,si:5},{hole:8,par:4,si:3},{hole:9,par:4,si:9},{hole:10,par:4,si:2},{hole:11,par:4,si:12},{hole:12,par:4,si:16},{hole:13,par:5,si:10},{hole:14,par:5,si:18},{hole:15,par:3,si:6},{hole:16,par:4,si:14},{hole:17,par:4,si:4},{hole:18,par:4,si:8}] },
  { id: "bryanston-cc", name: "Bryanston Country Club", city: "Bryanston", province: "Gauteng", par: 72, rating: 71.5, slope: 128, holes: [{hole:1,par:5,si:14},{hole:2,par:5,si:8},{hole:3,par:4,si:16},{hole:4,par:3,si:12},{hole:5,par:4,si:6},{hole:6,par:4,si:10},{hole:7,par:4,si:4},{hole:8,par:4,si:18},{hole:9,par:3,si:2},{hole:10,par:4,si:1},{hole:11,par:3,si:11},{hole:12,par:4,si:5},{hole:13,par:5,si:15},{hole:14,par:4,si:9},{hole:15,par:5,si:17},{hole:16,par:3,si:7},{hole:17,par:4,si:13},{hole:18,par:4,si:3}] },
  { id: "benoni-cc", name: "Benoni Country Club", city: "Benoni", province: "Gauteng", par: 72, rating: 72.0, slope: 130, holes: [{hole:1,par:5,si:15},{hole:2,par:4,si:7},{hole:3,par:3,si:11},{hole:4,par:4,si:1},{hole:5,par:4,si:3},{hole:6,par:4,si:9},{hole:7,par:4,si:5},{hole:8,par:3,si:17},{hole:9,par:5,si:13},{hole:10,par:5,si:14},{hole:11,par:4,si:6},{hole:12,par:3,si:18},{hole:13,par:4,si:10},{hole:14,par:4,si:2},{hole:15,par:3,si:16},{hole:16,par:4,si:4},{hole:17,par:4,si:8},{hole:18,par:5,si:12}] },
  { id: "benoni-lake", name: "Benoni Lake Golf Club", city: "Benoni", province: "Gauteng", par: 72, rating: 71.0, slope: 126, holes: [{hole:1,par:4,si:7},{hole:2,par:5,si:3},{hole:3,par:4,si:11},{hole:4,par:3,si:15},{hole:5,par:4,si:1},{hole:6,par:4,si:9},{hole:7,par:5,si:5},{hole:8,par:3,si:17},{hole:9,par:4,si:13},{hole:10,par:4,si:2},{hole:11,par:4,si:6},{hole:12,par:3,si:18},{hole:13,par:5,si:10},{hole:14,par:4,si:4},{hole:15,par:4,si:8},{hole:16,par:3,si:16},{hole:17,par:5,si:12},{hole:18,par:4,si:14}] },
  { id: "kempton-park", name: "Kempton Park Golf Club", city: "Kempton Park", province: "Gauteng", par: 71, rating: 70.0, slope: 122, holes: [{hole:1,par:5,si:4},{hole:2,par:4,si:16},{hole:3,par:4,si:12},{hole:4,par:4,si:2},{hole:5,par:3,si:10},{hole:6,par:4,si:6},{hole:7,par:4,si:14},{hole:8,par:4,si:8},{hole:9,par:3,si:18},{hole:10,par:4,si:13},{hole:11,par:3,si:17},{hole:12,par:5,si:11},{hole:13,par:5,si:5},{hole:14,par:4,si:1},{hole:15,par:4,si:3},{hole:16,par:4,si:9},{hole:17,par:3,si:15},{hole:18,par:4,si:7}] },
  { id: "reading-cc", name: "Reading Country Club", city: "Alberton", province: "Gauteng", par: 71, rating: 70.5, slope: 124, holes: [{hole:1,par:4,si:3},{hole:2,par:4,si:9},{hole:3,par:4,si:7},{hole:4,par:5,si:1},{hole:5,par:3,si:15},{hole:6,par:4,si:5},{hole:7,par:3,si:17},{hole:8,par:5,si:11},{hole:9,par:4,si:13},{hole:10,par:4,si:4},{hole:11,par:3,si:14},{hole:12,par:5,si:8},{hole:13,par:4,si:2},{hole:14,par:4,si:6},{hole:15,par:3,si:18},{hole:16,par:4,si:10},{hole:17,par:4,si:12},{hole:18,par:4,si:16}] },
  { id: "kyalami-cc", name: "Kyalami Country Club", city: "Midrand", province: "Gauteng", par: 72, rating: 72.0, slope: 128, holes: [{hole:1,par:4,si:11},{hole:2,par:4,si:5},{hole:3,par:3,si:7},{hole:4,par:5,si:13},{hole:5,par:4,si:1},{hole:6,par:3,si:17},{hole:7,par:4,si:9},{hole:8,par:4,si:3},{hole:9,par:5,si:15},{hole:10,par:4,si:6},{hole:11,par:4,si:2},{hole:12,par:4,si:12},{hole:13,par:5,si:18},{hole:14,par:3,si:14},{hole:15,par:4,si:10},{hole:16,par:4,si:4},{hole:17,par:3,si:8},{hole:18,par:5,si:16}] },
  { id: "irene-cc", name: "Irene Country Club", city: "Centurion", province: "Gauteng", par: 72, rating: 70.0, slope: 121, holes: [{hole:1,par:4,si:3},{hole:2,par:4,si:13},{hole:3,par:4,si:15},{hole:4,par:3,si:7},{hole:5,par:5,si:17},{hole:6,par:3,si:5},{hole:7,par:5,si:11},{hole:8,par:4,si:9},{hole:9,par:4,si:1},{hole:10,par:4,si:2},{hole:11,par:4,si:18},{hole:12,par:4,si:10},{hole:13,par:4,si:16},{hole:14,par:4,si:4},{hole:15,par:5,si:12},{hole:16,par:3,si:6},{hole:17,par:4,si:14},{hole:18,par:4,si:8}] },
  { id: "pretoria-cc", name: "Pretoria Country Club", city: "Pretoria", province: "Gauteng", par: 72, rating: 72.5, slope: 131, holes: [{hole:1,par:4,si:9},{hole:2,par:5,si:5},{hole:3,par:3,si:13},{hole:4,par:4,si:1},{hole:5,par:4,si:7},{hole:6,par:3,si:11},{hole:7,par:5,si:3},{hole:8,par:4,si:17},{hole:9,par:4,si:15},{hole:10,par:4,si:2},{hole:11,par:4,si:4},{hole:12,par:4,si:8},{hole:13,par:4,si:14},{hole:14,par:3,si:16},{hole:15,par:5,si:6},{hole:16,par:3,si:18},{hole:17,par:5,si:10},{hole:18,par:4,si:12}] },
  { id: "waterkloof", name: "Waterkloof Golf Club", city: "Pretoria", province: "Gauteng", par: 72, rating: 73.0, slope: 131, holes: [{hole:1,par:4,si:7},{hole:2,par:5,si:13},{hole:3,par:4,si:3},{hole:4,par:4,si:11},{hole:5,par:4,si:5},{hole:6,par:3,si:9},{hole:7,par:5,si:17},{hole:8,par:3,si:15},{hole:9,par:4,si:1},{hole:10,par:4,si:12},{hole:11,par:4,si:14},{hole:12,par:4,si:2},{hole:13,par:4,si:4},{hole:14,par:5,si:16},{hole:15,par:3,si:10},{hole:16,par:4,si:8},{hole:17,par:3,si:6},{hole:18,par:5,si:18}] },
  { id: "zwartkop-cc", name: "Zwartkop Country Club", city: "Centurion", province: "Gauteng", par: 72, rating: 72.5, slope: 130, holes: [{hole:1,par:4,si:5},{hole:2,par:4,si:9},{hole:3,par:3,si:15},{hole:4,par:5,si:3},{hole:5,par:4,si:7},{hole:6,par:4,si:11},{hole:7,par:5,si:1},{hole:8,par:3,si:17},{hole:9,par:4,si:13},{hole:10,par:4,si:4},{hole:11,par:5,si:14},{hole:12,par:4,si:2},{hole:13,par:3,si:16},{hole:14,par:4,si:10},{hole:15,par:4,si:6},{hole:16,par:3,si:18},{hole:17,par:4,si:8},{hole:18,par:5,si:12}] },
  { id: "blue-valley", name: "Blue Valley Golf Estate", city: "Centurion", province: "Gauteng", par: 72, rating: 73.5, slope: 135, holes: [{hole:1,par:4,si:16},{hole:2,par:3,si:10},{hole:3,par:5,si:18},{hole:4,par:4,si:6},{hole:5,par:5,si:14},{hole:6,par:4,si:2},{hole:7,par:4,si:12},{hole:8,par:3,si:8},{hole:9,par:4,si:4},{hole:10,par:4,si:11},{hole:11,par:4,si:1},{hole:12,par:3,si:15},{hole:13,par:5,si:17},{hole:14,par:4,si:3},{hole:15,par:3,si:9},{hole:16,par:4,si:7},{hole:17,par:4,si:5},{hole:18,par:5,si:13}] },
  { id: "blair-atholl", name: "Blair Atholl Golf Estate", city: "Lanseria", province: "Gauteng", par: 72, rating: 72.5, slope: 133, holes: [{hole:1,par:5,si:8},{hole:2,par:4,si:4},{hole:3,par:3,si:12},{hole:4,par:4,si:2},{hole:5,par:5,si:16},{hole:6,par:3,si:14},{hole:7,par:4,si:10},{hole:8,par:3,si:18},{hole:9,par:4,si:6},{hole:10,par:5,si:7},{hole:11,par:3,si:17},{hole:12,par:4,si:5},{hole:13,par:5,si:13},{hole:14,par:4,si:3},{hole:15,par:4,si:9},{hole:16,par:4,si:1},{hole:17,par:3,si:15},{hole:18,par:5,si:11}] },
  { id: "woodlands", name: "Woodlands Golf Club", city: "Pretoria", province: "Gauteng", par: 72, rating: 70.5, slope: 124, holes: [{hole:1,par:4,si:7},{hole:2,par:4,si:3},{hole:3,par:5,si:11},{hole:4,par:3,si:15},{hole:5,par:4,si:1},{hole:6,par:4,si:9},{hole:7,par:3,si:17},{hole:8,par:5,si:5},{hole:9,par:4,si:13},{hole:10,par:4,si:2},{hole:11,par:4,si:8},{hole:12,par:3,si:14},{hole:13,par:5,si:12},{hole:14,par:4,si:6},{hole:15,par:4,si:10},{hole:16,par:5,si:16},{hole:17,par:3,si:4},{hole:18,par:4,si:18}] },
  { id: "dainfern", name: "Dainfern Golf Estate", city: "Fourways", province: "Gauteng", par: 72, rating: 70.0, slope: 120, holes: [{hole:1,par:4,si:14},{hole:2,par:5,si:8},{hole:3,par:4,si:16},{hole:4,par:3,si:12},{hole:5,par:4,si:6},{hole:6,par:4,si:10},{hole:7,par:4,si:1},{hole:8,par:3,si:18},{hole:9,par:5,si:4},{hole:10,par:4,si:3},{hole:11,par:4,si:5},{hole:12,par:3,si:15},{hole:13,par:5,si:9},{hole:14,par:4,si:7},{hole:15,par:4,si:11},{hole:16,par:3,si:17},{hole:17,par:4,si:13},{hole:18,par:5,si:2}] },
  { id: "steyn-city", name: "The Club at Steyn City", city: "Midrand", province: "Gauteng", par: 72, rating: 73.0, slope: 137, holes: [{hole:1,par:4,si:12},{hole:2,par:4,si:6},{hole:3,par:5,si:14},{hole:4,par:4,si:2},{hole:5,par:3,si:16},{hole:6,par:5,si:8},{hole:7,par:4,si:4},{hole:8,par:4,si:10},{hole:9,par:3,si:18},{hole:10,par:5,si:9},{hole:11,par:4,si:3},{hole:12,par:3,si:15},{hole:13,par:4,si:7},{hole:14,par:3,si:17},{hole:15,par:4,si:1},{hole:16,par:5,si:13},{hole:17,par:4,si:5},{hole:18,par:4,si:11}] },
  { id: "jackal-creek", name: "Jackal Creek Golf Estate", city: "Honeydew", province: "Gauteng", par: 72, rating: 72.1, slope: 151, holes: [{hole:1,par:5,si:2,distances:{yellow:558,white:542,blue:505,red:476}},{hole:2,par:4,si:6,distances:{yellow:453,white:438,blue:405,red:353}},{hole:3,par:3,si:10,distances:{yellow:162,white:162,blue:127,red:102}},{hole:4,par:4,si:4,distances:{yellow:409,white:382,blue:365,red:331}},{hole:5,par:4,si:8,distances:{yellow:398,white:376,blue:313,red:259}},{hole:6,par:5,si:16,distances:{yellow:494,white:480,blue:426,red:389}},{hole:7,par:3,si:12,distances:{yellow:128,white:119,blue:109,red:66}},{hole:8,par:4,si:14,distances:{yellow:352,white:331,blue:311,red:284}},{hole:9,par:5,si:18,distances:{yellow:508,white:502,blue:459,red:434}},{hole:10,par:4,si:17,distances:{yellow:375,white:355,blue:301,red:285}},{hole:11,par:4,si:15,distances:{yellow:360,white:339,blue:293,red:265}},{hole:12,par:3,si:7,distances:{yellow:163,white:141,blue:129,red:103}},{hole:13,par:4,si:13,distances:{yellow:353,white:340,blue:294,red:277}},{hole:14,par:4,si:1,distances:{yellow:404,white:372,blue:316,red:292}},{hole:15,par:3,si:5,distances:{yellow:203,white:177,blue:166,red:144}},{hole:16,par:4,si:11,distances:{yellow:354,white:305,blue:261,red:248}},{hole:17,par:4,si:9,distances:{yellow:335,white:314,blue:296,red:266}},{hole:18,par:5,si:3,distances:{yellow:537,white:518,blue:474,red:414}}] },
];

const COURSES = RAW.map((c) => ({ ...c, tees: buildTees(c.rating, c.slope) }));

// ── Tee colour mappings ─────────────────────────────────────────────
const TEE_COLORS = { yellow: "#f0d080", white: "#ffffff", blue: "#5b9bd5", red: "#e63946" };
const TEE_DOT = (colour) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TEE_COLORS[colour]};border:1px solid #333"></span>`;

// ── HTML generator ──────────────────────────────────────────────────
function generateScorecard(course) {
  const front = course.holes.slice(0, 9);
  const back = course.holes.slice(9);
  const frontPar = front.reduce((s, h) => s + h.par, 0);
  const backPar = back.reduce((s, h) => s + h.par, 0);
  const hasDistances = course.holes.some((h) => h.distances);
  const teeColours = ["yellow", "white", "blue", "red"];

  function holeRow(label, holes, getValue, cls = "") {
    const total = holes.reduce((s, h) => s + (getValue(h) || 0), 0);
    return `<tr class="${cls}"><td class="label">${label}</td>${holes.map((h) => `<td>${getValue(h) ?? "–"}</td>`).join("")}<td class="total">${total || "–"}</td></tr>`;
  }

  function distRow(colour, holes) {
    if (!hasDistances) return "";
    const total = holes.reduce((s, h) => s + (h.distances?.[colour] || 0), 0);
    return `<tr class="dist"><td class="label">${TEE_DOT(colour)}</td>${holes.map((h) => `<td>${h.distances?.[colour] ?? "–"}</td>`).join("")}<td class="total">${total || "–"}</td></tr>`;
  }

  function nineTable(label, holes, parTotal) {
    return `
      <div class="nine">
        <table>
          <thead>
            <tr><th class="label">${label}</th>${holes.map((h) => `<th>${h.hole}</th>`).join("")}<th class="total">OUT</th></tr>
          </thead>
          <tbody>
            ${holeRow("Par", holes, (h) => h.par, "par-row")}
            ${holeRow("SI", holes, (h) => h.si, "si-row")}
            ${teeColours.map((c) => distRow(c, holes)).filter(Boolean).join("\n")}
            <tr class="score-row"><td class="label">Score</td>${holes.map(() => `<td></td>`).join("")}<td class="total"></td></tr>
            <tr class="pts-row"><td class="label">Pts</td>${holes.map(() => `<td></td>`).join("")}<td class="total"></td></tr>
          </tbody>
        </table>
      </div>`;
  }

  const teeInfo = course.tees.map((t) => `${TEE_DOT(t.colour)} CR ${t.cr} / Slope ${t.slope}`).join("&nbsp;&nbsp;&nbsp;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${course.name} – Scorecard | inthehole</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
  .card { max-width: 720px; margin: 0 auto; background: #141414; border-radius: 16px; overflow: hidden; border: 1px solid rgba(201,168,76,0.2); }
  .header { background: linear-gradient(160deg, #1e1e1e 0%, #141414 100%); padding: 24px; text-align: center; border-bottom: 2px solid #c9a84c; }
  .header h1 { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 4px; }
  .header .sub { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
  .header .par-badge { display: inline-block; margin-top: 8px; background: rgba(201,168,76,0.15); color: #c9a84c; font-size: 13px; font-weight: 700; padding: 4px 16px; border-radius: 20px; }
  .nine { padding: 16px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 4px; text-align: center; min-width: 32px; }
  thead th { background: #1e1e1e; color: #c9a84c; font-weight: 700; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #333; }
  .label { text-align: left; font-weight: 600; color: #888; min-width: 44px; padding-left: 8px; }
  .total { font-weight: 800; color: #c9a84c; border-left: 1px solid #333; }
  .par-row td { color: #fff; font-weight: 700; }
  .si-row td { color: #666; font-size: 10px; }
  .dist td { color: #aaa; font-size: 10px; }
  .score-row td { border-top: 1px solid #333; height: 28px; }
  .pts-row td { height: 28px; border-bottom: 1px solid #333; }
  .score-row .label, .pts-row .label { color: #c9a84c; }
  .divider { height: 1px; background: #333; margin: 0 16px; }
  .footer { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #333; }
  .footer .tees { font-size: 10px; color: #888; line-height: 1.8; }
  .footer .brand { text-align: right; }
  .footer .brand a { color: #c9a84c; text-decoration: none; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
  .footer .brand p { font-size: 9px; color: #555; margin-top: 2px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>${course.name}</h1>
    <p class="sub">${course.city}, ${course.province}</p>
    <span class="par-badge">Par ${course.par}</span>
  </div>

  ${nineTable("Front", front, frontPar)}
  <div class="divider"></div>
  ${nineTable("Back", back, backPar)}

  <div class="footer">
    <div class="tees">${teeInfo}</div>
    <div class="brand">
      <a href="https://cleanharry.world">Clean Harry</a>
      <p>Clean. Score. Perfect.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Generate all scorecards ─────────────────────────────────────────
const outDir = join(process.cwd(), "public/images/scorecards");
mkdirSync(outDir, { recursive: true });

const created = [];
for (const course of COURSES) {
  const filename = `${course.id}-scorecard.html`;
  const filepath = join(outDir, filename);
  writeFileSync(filepath, generateScorecard(course), "utf-8");
  created.push(filename);
}

console.log(`\n✓ Generated ${created.length} scorecards:\n`);
created.forEach((f) => console.log(`  public/images/scorecards/${f}`));
console.log("");
