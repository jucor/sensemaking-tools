// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Command } from "commander";
import * as fs from "fs";
import { getCommentsFromCsv } from "./runner_utils";
import { Sensemaker } from "../src/sensemaker";
import { VertexModel } from "../src/models/vertex_model";
import { Comment } from "../src/types";

interface TopicOutput {
  name: string;
  citations: string[];
  subtopics?: SubtopicOutput[];
}

interface SubtopicOutput {
  name: string;
  citations: string[];
}

interface OutputFormat {
  topics: TopicOutput[];
}

interface TopicInput {
  name: string;
  subtopics?: SubtopicInput[];
}

interface SubtopicInput {
  name: string;
}

/**
 * Example topics.json input file:
 * {
 *   "topics": [
 *     {
 *       "name": "Security",
 *       "subtopics": [
 *         { "name": "Authentication" },
 *         { "name": "Authorization" },
 *         { "name": "Encryption" }
 *       ]
 *     },
 *     {
 *       "name": "Performance",
 *       "subtopics": [
 *         { "name": "Load Time" },
 *         { "name": "Memory Usage" }
 *       ]
 *     },
 *     {
 *       "name": "Documentation"
 *       // No subtopics for this topic
 *     }
 *   ]
 * }
 */

// Processes categorized comments into the desired output format
function formatTopics(categorizedComments: Comment[]): OutputFormat {
  const topicMap = new Map<
    string,
    { citations: Set<string>; subtopics: Map<string, Set<string>> }
  >();

  // Process each comment
  categorizedComments.forEach((comment) => {
    comment.topics?.forEach((topic) => {
      // Initialize topic if not exists
      if (!topicMap.has(topic.name)) {
        topicMap.set(topic.name, {
          citations: new Set<string>(),
          subtopics: new Map<string, Set<string>>(),
        });
      }

      const topicData = topicMap.get(topic.name)!;
      topicData.citations.add(comment.id);

      // Process subtopics if they exist
      if ("subtopics" in topic) {
        topic.subtopics?.forEach((subtopic) => {
          if (!topicData.subtopics.has(subtopic.name)) {
            topicData.subtopics.set(subtopic.name, new Set<string>());
          }
          topicData.subtopics.get(subtopic.name)!.add(comment.id);
        });
      }
    });
  });

  // Convert to output format
  const output: OutputFormat = {
    topics: Array.from(topicMap.entries()).map(([topicName, data]) => ({
      name: topicName,
      citations: Array.from(data.citations).sort((a, b) => Number(a) - Number(b)),
      subtopics:
        data.subtopics.size > 0
          ? Array.from(data.subtopics.entries()).map(([subtopicName, citations]) => ({
              name: subtopicName,
              citations: Array.from(citations).sort((a, b) => Number(a) - Number(b)),
            }))
          : undefined,
    })),
  };

  return output;
}

async function main(): Promise<void> {
  const startTime = Date.now();

  // Parse command line arguments
  const program = new Command();
  program
    .option("-o, --outputFile <file>", "The output file name")
    .option("-i, --inputFile <file>", "The input file name")
    .option("-v, --vertexProject <project>", "The Vertex Project name")
    .option("-r, --region <region>", "The Vertex region", "us-central1")
    .option(
      "-t, --topicsFile <file>",
      "Optional JSON file containing predefined topics and subtopics"
    );
  program.parse(process.argv);
  const options = program.opts();

  // Initialize Sensemaker with Vertex model
  const mySensemaker = new Sensemaker({
    defaultModel: new VertexModel(options.vertexProject, options.region),
  });

  try {
    // Load comments
    console.log("Loading comments...");
    const comments = await getCommentsFromCsv(options.inputFile);
    console.log(`Loaded ${comments.length} comments`);

    let topics;
    if (options.topicsFile) {
      // Load predefined topics from JSON file
      console.log("Loading predefined topics...");
      const topicsContent = fs.readFileSync(options.topicsFile, "utf-8");
      const topicsJson = JSON.parse(topicsContent) as { topics: TopicInput[] };
      topics = topicsJson.topics;
      console.log(`Loaded ${topics.length} predefined topics`);
    } else {
      // Learn topics
      console.log("Learning topics...");
      topics = await mySensemaker.learnTopics(
        comments,
        true, // Include subtopics
        undefined,
        "Please identify the main topics and subtopics discussed in these comments"
      );
    }

    // Categorize comments
    console.log("Categorizing comments...");
    const categorizedComments = await mySensemaker.categorizeComments(
      comments,
      true, // Include subtopics
      topics
    );

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds

    // Process and format the output
    console.log("Processing results...");
    const output = formatTopics(categorizedComments);

    console.log("\n=== Categorization Summary ===");
    console.log(`Total comments processed: ${comments.length}`);
    console.log(`Total topics: ${output.topics.length}`);
    console.log(
      `Total subtopics: ${output.topics.reduce((acc, topic) => acc + (topic.subtopics?.length || 0), 0)}`
    );
    console.log(`Time taken: ${(duration / 60).toFixed(2)} minutes`);
    console.log("===========================\n");

    // Write to file
    const outputPath = `${options.outputFile}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Written topic categorization to ${outputPath}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
