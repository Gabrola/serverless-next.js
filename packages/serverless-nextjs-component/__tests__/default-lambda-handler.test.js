const { handler } = require("../default-lambda-handler");
const { createCloudFrontEvent } = require("../lib/test-utils");

jest.mock(
  "../manifest.json",
  () => require("./fixtures/default-build-manifest.json"),
  {
    virtual: true
  }
);

const mockPageRequire = mockPagePath => {
  jest.mock(
    `../${mockPagePath}`,
    () => require(`./fixtures/built-artifact/${mockPagePath}`),
    {
      virtual: true
    }
  );
};

describe("Lambda@Edge", () => {
  describe("Routing", () => {
    it.each`
      path        | expectedUri
      ${"/"}      | ${"/index.html"}
      ${"/index"} | ${"/index.html"}
      ${"/terms"} | ${"/terms.html"}
    `(
      "serves $path from S3 static-pages folder",
      async ({ path, expectedUri }) => {
        const event = createCloudFrontEvent({
          uri: path,
          host: "mydistribution.cloudfront.net",
          origin: {
            s3: {
              authMethod: "origin-access-identity",
              domainName: "my-bucket.s3.amazonaws.com",
              path: ""
            }
          }
        });

        const request = await handler(event, {});

        expect(request.origin).toEqual({
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: "/static-pages"
          }
        });
        expect(request.uri).toEqual(expectedUri);
      }
    );

    it("serves public file from S3 /public folder", async () => {
      const event = createCloudFrontEvent({
        uri: "/manifest.json",
        host: "mydistribution.cloudfront.net",
        origin: {
          s3: {
            authMethod: "origin-access-identity",
            domainName: "my-bucket.s3.amazonaws.com",
            path: ""
          }
        }
      });

      const request = await handler(event, {});

      expect(request.origin).toEqual({
        s3: {
          authMethod: "origin-access-identity",
          domainName: "my-bucket.s3.amazonaws.com",
          path: "/public"
        }
      });
      expect(request.uri).toEqual("/manifest.json");
    });
  });

  it("renders page", async () => {
    const event = createCloudFrontEvent({
      uri: "/customers",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/customers/index.js");

    const response = await handler(event, {});

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/customers/index.js");
    expect(response.status).toEqual(200);
  });

  it("renders 404 page if request path can't be matched to any page / api routes", async () => {
    const event = createCloudFrontEvent({
      uri: "/page/does/not/exist",
      host: "mydistribution.cloudfront.net",
      origin: {
        s3: {
          domainName: "my-bucket.amazonaws.com"
        }
      }
    });

    mockPageRequire("pages/_error.js");

    const response = await handler(event, {});

    const decodedBody = new Buffer(response.body, "base64").toString("utf8");

    expect(decodedBody).toEqual("pages/_error.js");
    expect(response.status).toEqual(200);
  });
});
