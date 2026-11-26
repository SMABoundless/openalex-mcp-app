import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { GroupWorksInputSchema } from "../schemas/common.js";
import { openalexRequest } from "../services/openalex-client.js";
import { num, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { formatGroups, groupsAreYears, groupsAreBoolean, groupLine, resolveGroupBy } from "../services/format-entities.js";
import type { OpenAlexGroupResponse } from "../types.js";
import type { GroupWorksOutput } from "../output-types.js";

export function registerGroupingTools(server: McpServer): void {
  registerAppTool(server, "openalex_group_works", {
    title: "Count Works by Group",
    description: `Count works by a field: how many works fall into each year, type, open access status, author, institution, country, journal, publisher, funder, subject, keyword or language. Use this for questions about volume, trends, breakdowns and rankings, instead of paging through search results.

Combine with a filter (and optionally a keyword query) to choose which works are counted.

group_by accepts these short names:
- year
- type (article, book, dataset, preprint, ...)
- oa_status (gold, green, hybrid, bronze, diamond, closed), is_oa
- author, institution, institution_type, country
- journal, publisher (a publisher's count includes its imprints)
- funder
- topic, subfield, field, domain (the work's main subject, from narrowest to broadest)
- keyword
- language
- sdg (UN Sustainable Development Goal)
- license
- top_10_percent, top_1_percent (whether the work is among the most cited of its year and subfield)
- retracted

It also accepts any OpenAlex works field that supports grouping, e.g. "has_fulltext".

Args:
  - group_by (string): What to count by: a short name above or an OpenAlex works field
  - query (string, optional): Keyword search restricting which works are counted
  - filter (string, optional): OpenAlex filter syntax, e.g. "authorships.institutions.id:I111979921,publication_year:2020-2024"
  - limit (number): Maximum groups to return, largest first (1-100, default: 25)

Returns: The total number of matching works, and each group with its count and share of that total. Groups that are OpenAlex entities include their ID for use in further filters. Shares can add up to more than 100% when a work can belong to several groups, such as several authors or institutions, and to less than 100% when some works have no value for the field.

Examples:
  - group_by "publication_year" with query "citation chaining": output on a subject over time
  - group_by "open_access.oa_status" with filter "authorships.institutions.id:I111979921,publication_year:2024": an institution's open access mix
  - group_by "journal" with filter "topics.id:T10001": which journals publish most on a topic
  - group_by "author" with filter "topics.id:T10001,publication_year:2020-2024": the most prolific authors on a topic
  - group_by "top_10_percent" with filter "authorships.institutions.id:I111979921,publication_year:2022": an institution's share of highly cited works`,
    inputSchema: GroupWorksInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/group-works.html" } },
  }, async ({ group_by, query, filter, limit }) => {
    try {
      const { field, label } = resolveGroupBy(group_by);
      const data = await openalexRequest<OpenAlexGroupResponse>({
        endpoint: "works",
        params: { search: query, filter, group_by: field },
        perPage: limit,
      });
      const total = data.meta.count;
      let groups = formatGroups(data.group_by ?? [], total);
      // The API returns the largest groups first; years read better in date order
      if (groupsAreYears(groups)) {
        groups = groups.slice().sort((a, b) => a.key.localeCompare(b.key));
      }
      const moreGroups = (data.group_by?.length ?? 0) >= limit;
      // A yes/no field leaves out works that have no value for it
      const withoutValue = groupsAreBoolean(groups)
        ? Math.max(0, total - groups.reduce((sum, g) => sum + g.count, 0))
        : 0;
      const output: GroupWorksOutput = {
        group_by: field,
        label,
        query: query ?? null,
        filter: filter ?? null,
        total_works: total,
        groups,
        more_groups: moreGroups,
        ...(withoutValue > 0 ? { works_without_value: withoutValue } : {}),
      };

      const scope = [query ? `matching "${query}"` : null, filter ? `with filter "${filter}"` : null]
        .filter(Boolean)
        .join(" ");
      if (groups.length === 0) {
        return toolResult(`No works found${scope ? ` ${scope}` : ""}, so there is nothing to count by ${label}.`, output);
      }
      const lines = [
        `## Works by ${label}`,
        `${num(total)} works${scope ? ` ${scope}` : ""}; ${groups.length} groups shown.`,
        "",
        ...groups.map(groupLine),
      ];
      if (withoutValue > 0) {
        lines.push("", `${num(withoutValue)} of the ${num(total)} works have no value for this field, so they are in neither group.`);
      }
      if (moreGroups) {
        lines.push("", `Only the ${groups.length} largest groups are shown${limit < 100 ? "; raise limit (up to 100) to see more" : ""}.`);
      }
      return toolResult(lines.join("\n"), output);
    } catch (error) {
      return toolError("grouping works", error);
    }
  });
}
