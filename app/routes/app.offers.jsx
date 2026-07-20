import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// ---------------------------------------------------------------------------
// Lists every synced "product_offer" metaobject (one per discount that has
// been synced by the app) as a table: title, type (code vs automatic),
// how many products it applies to, description, and its date range.
// Clicking a row opens the detail page for that offer.
// ---------------------------------------------------------------------------
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  let offers = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `query getOffers($cursor: String) {
        metaobjects(type: "$app:product_offer", first: 50, after: $cursor) {
          nodes {
            id
            fields { key value }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { variables: { cursor } }
    );
    const json = await response.json();
    const conn = json.data.metaobjects;
    offers.push(...conn.nodes);
    hasNextPage = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }

  const parsed = offers.map((node) => {
    const get = (key) => node.fields.find((f) => f.key === key)?.value || "";

    let linkedProductIds = [];
    try {
      linkedProductIds = JSON.parse(get("linked_product_ids") || "[]");
    } catch {
      linkedProductIds = [];
    }

    const discountGid = get("discount_gid");

    return {
      id: node.id,
      title: get("title"),
      description: get("description"),
      code: get("code"),
      startsAt: get("starts_at"),
      endsAt: get("ends_at"),
      type: discountGid.includes("DiscountCode")
        ? "Discount code"
        : "Automatic discount",
      productCount: linkedProductIds.length,
    };
  });

  return { offers: parsed };
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Offers() {
  const { offers } = useLoaderData();

  return (
    <s-page heading="Offers">
      <s-section
        padding="none"
        heading={`${offers.length} synced offer${offers.length === 1 ? "" : "s"}`}
      >
        {offers.length === 0 ? (
          <s-paragraph>
            No offers yet. Create a discount targeting specific products or a
            collection in Shopify, and it will appear here automatically.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Title</s-table-header>
              <s-table-header listSlot="inline">Type</s-table-header>
              <s-table-header listSlot="labeled">Code</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">
                Applies to
              </s-table-header>
              <s-table-header listSlot="secondary">Description</s-table-header>
              <s-table-header listSlot="labeled">Starts</s-table-header>
              <s-table-header listSlot="labeled">Ends</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {offers.map((offer, i) => (
                <s-table-row key={offer.id} clickDelegate={`offer-link-${i}`}>
                  <s-table-cell>
                    <s-link
                      id={`offer-link-${i}`}
                      href={`/app/offers/${encodeURIComponent(offer.id)}`}
                    >
                      {offer.title || "Untitled"}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={offer.type === "Discount code" ? "info" : "success"}
                    >
                      {offer.type}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{offer.code || "—"}</s-table-cell>
                  <s-table-cell>
                    {offer.productCount} product
                    {offer.productCount === 1 ? "" : "s"}
                  </s-table-cell>
                  <s-table-cell>{offer.description || "—"}</s-table-cell>
                  <s-table-cell>{formatDate(offer.startsAt)}</s-table-cell>
                  <s-table-cell>
                    {offer.endsAt ? formatDate(offer.endsAt) : "No end date"}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
