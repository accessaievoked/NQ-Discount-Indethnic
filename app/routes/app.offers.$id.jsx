import { useNavigate } from "react-router";
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
  const navigate = useNavigate();

  const discountNumericId = offer.discountGid.split("/").pop();
  const discountAdminUrl = `https://admin.shopify.com/store/${shopHandle}/discounts/${discountNumericId}`;

  return (
    <s-page heading={offer.title || "Offer"}>
      <style>{`
        .offer-detail-back {
          background: none;
          border: none;
          padding: 0;
          margin-bottom: 1rem;
          font-size: .8125rem;
          font-weight: 600;
          color: #2c6ecb;
          cursor: pointer;
        }
        .offer-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .offer-detail-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0;
        }
        .offer-detail-subtitle {
          margin-top: .375rem;
          display: flex;
          align-items: center;
          gap: .5rem;
        }
        .offers-dash-badge {
          display: inline-block;
          padding: .1875rem .5rem;
          border-radius: 999px;
          font-size: .6875rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .offers-dash-badge.is-automatic {
          background: #e3f5e9;
          color: #1e7a43;
        }
        .offers-dash-badge.is-code {
          background: #e5f0ff;
          color: #1655b3;
        }
        .offer-detail-code {
          font-size: .8125rem;
          color: #6b6b6b;
        }
        .offers-dash-card {
          background: #fff;
          border: 1px solid #e3e3e3;
          border-radius: 10px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1rem;
        }
        .offer-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.25rem;
        }
        .offer-detail-field-label {
          font-size: .6875rem;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #8a8a8a;
          font-weight: 700;
          margin-bottom: .25rem;
        }
        .offer-detail-field-value {
          font-size: .875rem;
          color: #1a1a1a;
        }
        .offer-detail-description {
          margin-top: 1.25rem;
        }
        .offer-detail-link-row {
          margin-top: 1.25rem;
        }
        .offer-detail-link-row a {
          font-size: .8125rem;
          font-weight: 600;
          color: #2c6ecb;
          text-decoration: none;
        }
        .offers-dash-table {
          width: 100%;
          border-collapse: collapse;
          font-size: .8125rem;
        }
        .offers-dash-table thead th {
          text-align: left;
          font-size: .6875rem;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #8a8a8a;
          font-weight: 700;
          padding: .625rem .75rem;
          background: #fafafa;
          border-bottom: 1px solid #e3e3e3;
        }
        .offers-dash-table tbody td {
          padding: .75rem;
          border-bottom: 1px solid #efefef;
          color: #1a1a1a;
          vertical-align: middle;
        }
        .offers-dash-row-index {
          color: #8a8a8a;
        }
        .offers-dash-title-link {
          color: #2c6ecb;
          font-weight: 600;
          text-decoration: none;
        }
        .offers-dash-empty {
          padding: 2rem;
          text-align: center;
          color: #8a8a8a;
          font-size: .875rem;
        }
        .offer-detail-section-title {
          font-size: .875rem;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 1rem;
        }
      `}</style>

      <button
        type="button"
        className="offer-detail-back"
        onClick={() => navigate("/app")}
      >
        ← Back to offers
      </button>

      <div className="offer-detail-header">
        <div>
          <p className="offer-detail-title">{offer.title || "Offer"}</p>
          <div className="offer-detail-subtitle">
            <span
              className={`offers-dash-badge ${
                offer.type === "Discount code" ? "is-code" : "is-automatic"
              }`}
            >
              {offer.type}
            </span>
            {offer.code && (
              <span className="offer-detail-code">Code: {offer.code}</span>
            )}
          </div>
        </div>
      </div>

      <div className="offers-dash-card">
        <div className="offer-detail-grid">
          {offer.usageLimit && (
            <div>
              <div className="offer-detail-field-label">Usage limit</div>
              <div className="offer-detail-field-value">{offer.usageLimit}</div>
            </div>
          )}
          <div>
            <div className="offer-detail-field-label">Starts</div>
            <div className="offer-detail-field-value">
              {formatDate(offer.startsAt)}
            </div>
          </div>
          <div>
            <div className="offer-detail-field-label">Ends</div>
            <div className="offer-detail-field-value">
              {offer.endsAt ? formatDate(offer.endsAt) : "No end date"}
            </div>
          </div>
          <div>
            <div className="offer-detail-field-label">Applies to</div>
            <div className="offer-detail-field-value">
              {products.length} product{products.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {offer.description && (
          <div className="offer-detail-description">
            <div className="offer-detail-field-label">Description</div>
            <div className="offer-detail-field-value">{offer.description}</div>
          </div>
        )}

        <div className="offer-detail-link-row">
          <a href={discountAdminUrl} target="_blank" rel="noreferrer">
            View discount in Shopify admin →
          </a>
        </div>
      </div>

      <div className="offers-dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem 0" }}>
          <p className="offer-detail-section-title">
            Products ({products.length})
          </p>
        </div>
        {products.length === 0 ? (
          <div className="offers-dash-empty">
            No products are currently linked to this offer.
          </div>
        ) : (
          <table className="offers-dash-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => {
                const numericId = product.id.split("/").pop();
                return (
                  <tr key={product.id}>
                    <td className="offers-dash-row-index">{i + 1}</td>
                    <td>
                      <a
                        className="offers-dash-title-link"
                        href={`https://admin.shopify.com/store/${shopHandle}/products/${numericId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {product.title}
                      </a>
                    </td>
                    <td>
                      <span
                        className={`offers-dash-badge ${
                          product.status === "ACTIVE" ? "is-automatic" : "is-code"
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
