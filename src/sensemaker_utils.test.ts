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

import { getPrompt, groupCommentsBySubtopic, formatCommentsWithVotes } from "./sensemaker_utils";
import { Comment } from "./types";

const TEST_COMMENTS = [
  {
    id: "1",
    text: "comment1",
    voteTalliesByGroup: {
      "0": {
        agreeCount: 10,
        disagreeCount: 5,
        passCount: 0,
        totalCount: 15,
      },
      "1": {
        agreeCount: 5,
        disagreeCount: 10,
        passCount: 5,
        totalCount: 20,
      },
    },
  },
  {
    id: "2",
    text: "comment2",
    voteTalliesByGroup: {
      "0": {
        agreeCount: 2,
        disagreeCount: 5,
        passCount: 3,
        totalCount: 10,
      },
      "1": {
        agreeCount: 5,
        disagreeCount: 3,
        passCount: 2,
        totalCount: 10,
      },
    },
  },
];

describe("SensemakerUtilsTest", () => {
  it("should create a prompt", () => {
    expect(getPrompt("Summarize this.", ["comment1", "comment2"])).toEqual(
      `Instructions:
Summarize this.

Comments:
comment1
comment2`
    );
  });

  it("should include additional instructions in the prompt", () => {
    expect(
      getPrompt(
        "Summarize this.",
        ["comment1", "comment2"],
        "This is for a town hall style conversation"
      )
    ).toEqual(
      `Instructions:
Summarize this.

Additional context:
This is for a town hall style conversation

Comments:
comment1
comment2`
    );
  });
  describe("groupCommentsByTopic", () => {
    it("should group comments by topic and subtopic", () => {
      const comment1: Comment = {
        id: "1",
        text: "Comment 1",
        topics: [
          { name: "Topic 1", subtopics: [{ name: "Subtopic 1.1" }] },
          { name: "Topic 2", subtopics: [{ name: "Subtopic 2.1" }] },
        ],
      };
      const comment2: Comment = {
        id: "2",
        text: "Comment 2",
        topics: [
          { name: "Topic 1", subtopics: [{ name: "Subtopic 1.1" }] },
          { name: "Topic 1", subtopics: [{ name: "Subtopic 1.2" }] },
        ],
      };

      const categorizedComments: Comment[] = [comment1, comment2];

      const expectedOutput = {
        "Topic 1": {
          "Subtopic 1.1": {
            "1": comment1,
            "2": comment2,
          },
          "Subtopic 1.2": {
            "2": comment2,
          },
        },
        "Topic 2": {
          "Subtopic 2.1": {
            "1": comment1,
          },
        },
      };

      const result = groupCommentsBySubtopic(categorizedComments);
      expect(result).toEqual(expectedOutput);
    });

    it("should skip comment if it has no topics", () => {
      const categorizedComments: Comment[] = [
        {
          id: "1",
          text: "Comment 1",
          topics: [], // No topics assigned
        },
      ];

      expect(groupCommentsBySubtopic(categorizedComments)).toEqual({});
    });
  });
  it("should format comments with vote tallies via formatCommentsWithVotes", () => {
    expect(formatCommentsWithVotes(TEST_COMMENTS)).toEqual([
      `comment1
      vote info per group: {"0":{"agreeCount":10,"disagreeCount":5,"passCount":0,"totalCount":15},"1":{"agreeCount":5,"disagreeCount":10,"passCount":5,"totalCount":20}}`,
      `comment2
      vote info per group: {"0":{"agreeCount":2,"disagreeCount":5,"passCount":3,"totalCount":10},"1":{"agreeCount":5,"disagreeCount":3,"passCount":2,"totalCount":10}}`,
    ]);
  });
});
