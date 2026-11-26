import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { GroupWorksInputSchema } from "../schemas/common.js";
import { openalexRequest } from "../services/openalex-client.js";
import { num, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { formatGroups, groupsAreYears, groupLine } from "../services/format-entities.js";
import type { GroupByResult } from "../types.js";
import type { GroupWorksOutput } from "../output-types.js";

interface GroupResponse {
  meta: { count: number; groups_count: number | null };
  group_by: GroupByResult[];
}

export function registerGroupingTools(server: McpServer): void {
  registerAppTool(server, "openalex_group_works", {
    title: "Count Works by Group",
    description: `Count works by a field: how many works fall into each year, type, open access status, institution, journal, topic, funder or country. Use this for questions about volume, trends and breakdowns, instead of paging through search results.

Combine with a filter (and optionally a keyword query) to choose which works are counted.

Common group_by fields:
- publication_year
- type (article, book, dataset, preprint, ...)
- open_access.oa_status (gold, green, hybrid, bronze, diamond, closed)
- is_oa
- primary_topic.id, primary_topic.field.id, primary_topic.domain.id
- primary_location.source.id (journal)
- authorships.institutions.id, authorships.author.id, authorships.countries
- funders.id
- language

Args:
  - group_by (string): The works field to count by
  - query (string, optional): Keyword search restricting which works are counted
  - filter (string, optional): OpenAlex filter syntax, e.g. "authorships.institutions.id:I111979921,publication_year:2020-2024"
  - limit (number): Maximum groups to return, largest first (1-100, default: 25)

Returns: The total number of matching works, and each group with its count and share of that total. Groups that are OpenAlex entities include their ID for use in further filters. Shares can add up to more than 100% when a work can belong to several groups, such as several institutions.

Examples:
  - group_by "publication_year" with query "citation chaining": output on a subject over time
  - group_by "open_access.oa_status" with filter "authorships.institutions.id:I111979921,publication_year:2024": an institution's open access mix
  - group_by "primary_location.source.id" with filter "topics.id:T10001": which journals publish most on a topic`,
    inputSchema: GroupWorksInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/group-works.html" } },
  }, async ({ group_by, query, filter, limit }) => {
    try {
      const data = await openalexRequest<GroupResponse>({
        endpoint: "works",
        params: { search: query, filter, group_by },
        perPage: limit,
      });
      const total = data.meta.count;
      let groups = formatGroups(data.group_by ?? [], total);
      // The API returns the largest groups first; years read better in date order
      if (groupsAreYears(groups)) {
        groups = groups.slice().sort((a, b) => a.key.localeCompare(b.key));
      }
      const moreGroups = (data.group_by?.length ?? 0) >= limit;
      const output: GroupWorksOutput = {
        group_by,
        query: query ?? null,
        filter: filter ?? null,
        total_works: total,
        groups,
        more_groups: moreGroups,
      };

      const scope = [query ? `matching "${query}"` : null, filter ? `with filter "${filter}"` : null]
        .filter(Boolean)
        .join(" ");
      if (groups.length === 0) {
        return toolResult(`No works found${scope ? ` ${scope}` : ""}, so there is nothing to group by ${group_by}.`, output);
      }
      const lines = [
        `## Works by ${group_by}`,
        `${num(total)} works${scope ? ` ${scope}` : ""}; ${groups.length} groups shown.`,
        "",
        ...groups.map(groupLine),
      ];
      if (moreGroups) {
        lines.push("", `Only the ${groups.length} largest groups are shown${limit < 100 ? "; raise limit (up to 100) to see more" : ""}.`);
      }
      return toolResult(lines.join("\n"), output);
    } catch (error) {
      return toolError("grouping works", error);
    }
  });
}
