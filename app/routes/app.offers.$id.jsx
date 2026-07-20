import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// ---------------------------------------------------------------------------
// Detail view for a single synced offer: full discount info plus the live
// list of products it's currently attached to.
// ---------------------------------------------------------------------------
export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const id = decodeURIComponent(params.id);

  const response = await admin.graphql(
    `query getOffer($id: ID!) {
      metaobject(id: $id) {
        id
        fields { key value }
      }
    }`,
    { variables: { id } }
  );
  const json = await response.json();
  const node = json.data.metaobject;

  if (!node) {
    throw new Response("Offer not found", { status: 404 });
  }

  const get = (key) => node.fields.find((f) => f.key === key)?.value || "";

  let linkedProductIds = [];
  try {
    linkedProductIds = JSON.parse(get("linked_product_ids") || "[]");
  } catch {
    linkedProductIds = [];
  }

  let products = [];
  if (linkedProductIds.length > 0) {
    const productsResponse = await admin.graphql(
      `query getOfferProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            status
          }
        }
      }`,
      { variables: { ids: linkedProductIds } }
    );
    const productsJson = await productsResponse.json();
    products = (productsJson.data.nodes || []).filter(Boolean);
  }

  const discountGid = get("discount_gid");
  const shopHandle = session.shop.replace(".myshopify.com", "");

  return {
    offer: {
      id: node.id,
      title: get("title"),
      description: get("description"),
      code: get("code"),
      usageLimit: get("usage_limit"),
      startsAt: get("starts_at"),
      endsAt: get("ends_at"),
      discountGid,
      type: discountGid.includes("DiscountCode")
        ? "Discount code"
        : "Automatic discount",
    },
    products,
    shopHandle,
  };
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OfferDetail() {
  const { offer, products, shopHandle } = useLoaderData();

  const discountNumericId = offer.discountGid.split("/").pop();
  const discountAdminUrl = `https://admin.shopify.com/store/${shopHandle}/discounts/${discountNumericId}`;

  return (
    <s-page heading={offer.title || "Offer"}>
      <s-link slot="primary-action" href="/app/offers">
        Back to offers
      </s-link>

      <s-section heading="Offer details">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Type: </s-text>
            <s-badge tone={offer.type === "Discount code" ? "info" : "success"}>
              {offer.type}
            </s-badge>
          </s-paragraph>

          {offer.code && (
            <s-paragraph>
              <s-text>Code: </s-text>
              {offer.code}
            </s-paragraph>
          )}

          {offer.usageLimit && (
            <s-paragraph>
              <s-text>Usage limit: </s-text>
              {offer.usageLimit}
            </s-paragraph>
          )}

          <s-paragraph>
            <s-text>Starts: </s-text>
            {formatDate(offer.startsAt)}
          </s-paragraph>

          <s-paragraph>
            <s-text>Ends: </s-text>
            {offer.endsAt ? formatDate(offer.endsAt) : "No end date"}
          </s-paragraph>

          {offer.description && (
            <s-paragraph>
              <s-text>Description: </s-text>
              {offer.description}
            </s-paragraph>
          )}

          <s-paragraph>
            <s-link href={discountAdminUrl} target="_blank">
              View discount in Shopify admin
            </s-link>
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section
        padding="none"
        heading={`Products (${products.length})`}
      >
        {products.length === 0 ? (
          <s-paragraph>
            No products are currently linked to this offer.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.map((product) => {
                const numericId = product.id.split("/").pop();
                return (
                  <s-table-row
                    key={product.id}
                    clickDelegate={`product-link-${numericId}`}
                  >
                    <s-table-cell>
                      <s-link
                        id={`product-link-${numericId}`}
                        href={`https://admin.shopify.com/store/${shopHandle}/products/${numericId}`}
                        target="_blank"
                      >
                        {product.title}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge
                        tone={product.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {product.status}
                      </s-badge>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
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
