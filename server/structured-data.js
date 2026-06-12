import { attrMap, extractMetaContent, normalizeUrl, textContent } from './scan-parsers.js';

const STRUCTURED_DATA_RULES = {
  Product: {
    required: [["name"]],
    requiredAny: [["offers", "review", "aggregateRating"]],
    recommended: ["image", "description", "sku", "brand"],
  },
  BreadcrumbList: {
    required: [["itemListElement"]],
  },
  FAQPage: {
    required: [["mainEntity"]],
  },
  LocalBusiness: {
    required: [["name"], ["address"]],
    recommended: ["url", "telephone", "image", "openingHoursSpecification"],
  },
  VideoObject: {
    required: [["name"], ["thumbnailUrl"], ["uploadDate"]],
    recommended: ["description", "contentUrl", "embedUrl", "duration"],
  },
  Recipe: {
    required: [["name"], ["image"]],
    recommended: ["author", "datePublished", "description", "prepTime", "cookTime", "recipeIngredient", "recipeInstructions"],
  },
  Event: {
    required: [["name"], ["startDate"], ["location"]],
    recommended: ["description", "image", "endDate", "offers", "performer"],
  },
  JobPosting: {
    required: [["title"], ["description"], ["datePosted"], ["hiringOrganization"]],
    requiredAny: [["jobLocation", "applicantLocationRequirements"]],
    recommended: ["validThrough", "employmentType", "baseSalary", "identifier"],
  },
  Course: {
    required: [["name"], ["description"]],
    recommended: ["provider"],
  },
  Dataset: {
    required: [["name"], ["description"]],
    recommended: ["creator", "license", "identifier", "distribution"],
  },
  SoftwareApplication: {
    required: [["name"], ["offers"]],
    requiredAny: [["aggregateRating", "review"]],
    recommended: ["applicationCategory", "operatingSystem"],
  },
  ProfilePage: {
    required: [["mainEntity"]],
    recommended: ["dateCreated", "dateModified"],
  },
  QAPage: {
    required: [["mainEntity"]],
  },
  DiscussionForumPosting: {
    required: [["author"], ["datePublished"]],
    requiredAny: [["text", "image", "video", "url"]],
    recommended: ["url", "comment", "commentCount", "dateModified"],
  },
  SocialMediaPosting: {
    required: [["author"], ["datePublished"]],
    requiredAny: [["text", "image", "video", "url"]],
    recommended: ["url", "comment", "commentCount", "dateModified"],
  },
  ItemList: {
    required: [["itemListElement"]],
  },
  Movie: {
    required: [["name"], ["image"]],
    recommended: ["aggregateRating", "dateCreated", "director", "review"],
  },
  EmployerAggregateRating: {
    required: [["itemReviewed"], ["ratingValue"]],
    requiredAny: [["ratingCount", "reviewCount"]],
    recommended: ["bestRating", "worstRating"],
  },
  ClaimReview: {
    required: [["claimReviewed"], ["reviewRating"], ["url"]],
    recommended: ["author", "itemReviewed"],
  },
  ImageObject: {
    requiredAny: [["contentUrl", "url"], ["creator", "creditText", "copyrightNotice", "license"]],
    recommended: ["license", "acquireLicensePage", "creator", "creditText", "copyrightNotice"],
  },
  VacationRental: {
    required: [["containsPlace"], ["identifier"], ["image"], ["name"]],
    requiredAny: [["latitude", "geo"], ["longitude", "geo"]],
    recommended: ["address", "aggregateRating", "brand", "description", "review"],
  },
  Review: {
    required: [["author"], ["itemReviewed"], ["reviewRating"]],
    recommended: ["datePublished", "reviewBody"],
  },
  AggregateRating: {
    required: [["itemReviewed"], ["ratingValue"]],
    requiredAny: [["ratingCount", "reviewCount"]],
    recommended: ["bestRating", "worstRating"],
  },
  MathSolver: {
    required: [["potentialAction"], ["url"], ["usageInfo"]],
    recommended: ["inLanguage", "assesses"],
  },
};

const ARTICLE_TYPES = new Set(["Article", "NewsArticle", "BlogPosting"]);
const LOCAL_BUSINESS_TYPES = new Set([
  "LocalBusiness", "Restaurant", "Store", "Hotel", "LodgingBusiness", "MedicalBusiness",
  "ProfessionalService", "FoodEstablishment", "HealthAndBeautyBusiness", "HomeAndConstructionBusiness",
]);
const GOOGLE_VALIDATED_TYPES = new Set([
  ...Object.keys(STRUCTURED_DATA_RULES),
  ...ARTICLE_TYPES,
  ...LOCAL_BUSINESS_TYPES,
  "Organization",
  "WebSite",
]);
const COMMON_HELPER_TYPES = new Set([
  "WebPage", "Person", "Organization", "Brand", "Offer", "AggregateOffer", "Rating", "AggregateRating",
  "PostalAddress", "Place", "Question", "Answer", "ListItem", "DataDownload", "QuantitativeValue",
  "InteractionCounter", "EntryPoint", "SeekToAction", "Clip", "BroadcastEvent", "CreativeWork", "Claim",
]);

function structuredTypes(node) {
  const value = node?.["@type"];
  return (Array.isArray(value) ? value : value ? [value] : []).map(String);
}

function hasStructuredValue(node, property) {
  const value = node?.[property];
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function graphUrl(value, baseUrl) {
  try {
    return new URL(String(value), baseUrl).toString();
  } catch {
    return "";
  }
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isNonNegativeNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function inspectJsonLd(html, baseUrl, pageTitle = "") {
  const re = /<script\b([^>]*?)>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  const nodes = [];
  const diagnostics = [];
  const visibleText = textContent(html).toLowerCase();
  const visibleImages = new Set();
  const imageRe = /<img\b([^>]*?)>/gi;
  let imageMatch;
  while ((imageMatch = imageRe.exec(html))) {
    const attrs = attrMap(imageMatch[1]);
    for (const value of [attrs.src, attrs["data-src"], attrs["data-lazy-src"]]) {
      const imageUrl = value ? graphUrl(value, baseUrl) : "";
      if (imageUrl) visibleImages.add(imageUrl);
    }
    const srcset = attrs.srcset || attrs["data-srcset"];
    for (const candidate of String(srcset || "").split(",")) {
      const imageUrl = graphUrl(candidate.trim().split(/\s+/)[0], baseUrl);
      if (imageUrl) visibleImages.add(imageUrl);
    }
  }
  const openGraphImage = extractMetaContent(html, "og:image");
  if (openGraphImage) visibleImages.add(graphUrl(openGraphImage, baseUrl));
  let invalidCount = 0;
  let match;
  while ((match = re.exec(html))) {
    const attrs = attrMap(match[1]);
    if ((attrs.type || "").toLowerCase() !== "application/ld+json") continue;
    try {
      const parsed = JSON.parse(match[2].trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (!value?.["@context"]) {
          diagnostics.push({
            severity: "warning",
            code: "missing_context",
            type: "JSON-LD",
            property: "@context",
            detail: "Missing @context on the top-level JSON-LD object",
          });
        }
        const graphNodes = Array.isArray(value?.["@graph"]) ? value["@graph"] : [value];
        blocks.push({ nodeCount: graphNodes.length });
        for (const node of graphNodes) {
          if (node && typeof node === "object" && !Array.isArray(node)) nodes.push(node);
        }
      }
    } catch (error) {
      invalidCount += 1;
      diagnostics.push({
        severity: "warning",
        code: "json_syntax",
        type: "JSON-LD",
        property: "",
        detail: String(error.message || error),
      });
    }
  }

  const ids = new Set();
  const references = [];
  const visit = (value, property = "", isRoot = false) => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, property));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value["@id"]) {
      const id = graphUrl(value["@id"], baseUrl);
      if (isRoot || value["@type"] || Object.keys(value).length > 1) ids.add(id);
      else references.push({ id, property });
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "@id") visit(child, key);
    }
  };
  nodes.forEach((node) => visit(node, "", true));
  let baseDocument = "";
  try {
    const parsedBase = new URL(baseUrl);
    parsedBase.hash = "";
    baseDocument = parsedBase.toString();
  } catch {
    baseDocument = baseUrl;
  }
  for (const reference of references) {
    try {
      const target = new URL(reference.id);
      const documentUrl = new URL(target);
      documentUrl.hash = "";
      if (target.hash && documentUrl.toString() === baseDocument && !ids.has(target.toString())) {
        diagnostics.push({
          severity: "warning",
          code: "unresolved_reference",
          type: "JSON-LD",
          property: reference.property,
          detail: reference.id,
        });
      }
    } catch {
      // Invalid URLs are reported by the property validation below.
    }
  }

  const summaries = [];
  const addDiagnostic = (severity, code, type, property, detail) => {
    diagnostics.push({ severity, code, type, property, detail });
  };
  for (const node of nodes) {
    const types = structuredTypes(node);
    const primaryType = types[0] || "Unknown";
    const validated = types.some((type) => GOOGLE_VALIDATED_TYPES.has(type));
    summaries.push({
      id: node["@id"] || "",
      types,
      name: node.name || node.headline || "",
      validated,
    });

    let rule = STRUCTURED_DATA_RULES[primaryType];
    if (!rule && types.some((type) => LOCAL_BUSINESS_TYPES.has(type))) rule = STRUCTURED_DATA_RULES.LocalBusiness;
    if (rule) {
      for (const [property] of rule.required || []) {
        if (!hasStructuredValue(node, property)) addDiagnostic("warning", "missing_required", primaryType, property, `Missing ${property}`);
      }
      for (const properties of rule.requiredAny || []) {
        if (!properties.some((property) => hasStructuredValue(node, property))) {
          addDiagnostic("warning", "missing_required_any", primaryType, properties.join(" / "), `Include one of: ${properties.join(", ")}`);
        }
      }
      for (const property of rule.recommended || []) {
        if (!hasStructuredValue(node, property)) addDiagnostic("notice", "missing_recommended", primaryType, property, `Consider adding ${property}`);
      }
    }
    if (primaryType !== "Unknown" && !validated && !COMMON_HELPER_TYPES.has(primaryType)) {
      addDiagnostic("notice", "type_not_validated", primaryType, "@type", "Parsed successfully, but no Google-specific rule is configured");
    }

    if (types.some((type) => ARTICLE_TYPES.has(type))) {
      for (const property of ["headline", "image", "datePublished", "author"]) {
        if (!hasStructuredValue(node, property)) addDiagnostic("notice", "missing_recommended", primaryType, property, `Consider adding ${property}`);
      }
    }
    if (types.includes("Organization") || types.includes("WebSite")) {
      for (const property of types.includes("WebSite") ? ["name", "url"] : ["name", "url", "logo"]) {
        if (!hasStructuredValue(node, property)) addDiagnostic("notice", "missing_recommended", primaryType, property, `Consider adding ${property}`);
      }
    }

    if (types.includes("BreadcrumbList") && Array.isArray(node.itemListElement)) {
      if (node.itemListElement.length < 2) {
        addDiagnostic("warning", "invalid_breadcrumb", primaryType, "itemListElement", "Google expects at least two breadcrumb items");
      }
      node.itemListElement.forEach((item, index) => {
        if (!hasStructuredValue(item, "position")) addDiagnostic("warning", "missing_required", "ListItem", "position", `Breadcrumb item ${index + 1}`);
        if (!hasStructuredValue(item, "name")) addDiagnostic("warning", "missing_required", "ListItem", "name", `Breadcrumb item ${index + 1}`);
        if (index < node.itemListElement.length - 1 && !hasStructuredValue(item, "item")) {
          addDiagnostic("warning", "missing_required", "ListItem", "item", `Breadcrumb item ${index + 1}`);
        }
      });
    }

    if (types.includes("FAQPage") && Array.isArray(node.mainEntity)) {
      node.mainEntity.forEach((question, index) => {
        if (!hasStructuredValue(question, "name")) addDiagnostic("warning", "missing_required", "Question", "name", `Question ${index + 1}`);
        if (!hasStructuredValue(question, "acceptedAnswer")) {
          addDiagnostic("warning", "missing_required", "Question", "acceptedAnswer", `Question ${index + 1}`);
        } else if (!hasStructuredValue(question.acceptedAnswer, "text")) {
          addDiagnostic("warning", "missing_required", "Answer", "text", `Question ${index + 1}`);
        }
      });
    }

    if (types.includes("Product")) {
      const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
      offers.forEach((offer, index) => {
        const price = offer?.price ?? offer?.priceSpecification?.price;
        if (price === undefined || price === null || price === "") {
          addDiagnostic("warning", "missing_required", "Offer", "price", `Offer ${index + 1}`);
        }
        const currency = offer?.priceCurrency ?? offer?.priceSpecification?.priceCurrency;
        if (!currency) addDiagnostic("notice", "missing_recommended", "Offer", "priceCurrency", `Offer ${index + 1}`);
      });
    }

    if (types.includes("SoftwareApplication")) {
      const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
      offers.forEach((offer, index) => {
        if (!isNonNegativeNumber(offer?.price ?? offer?.priceSpecification?.price)) {
          addDiagnostic("warning", "invalid_value", "Offer", "price", `Software offer ${index + 1} needs a non-negative price`);
        }
      });
    }

    if (types.includes("Review")) {
      const reviewAuthor = node.author;
      if (reviewAuthor && typeof reviewAuthor === "object" && !hasStructuredValue(reviewAuthor, "name")) {
        addDiagnostic("warning", "missing_required", structuredTypes(reviewAuthor)[0] || "Author", "name", "Review author");
      }
      if (node.reviewRating && typeof node.reviewRating === "object" && !hasStructuredValue(node.reviewRating, "ratingValue")) {
        addDiagnostic("warning", "missing_required", "Rating", "ratingValue", "Review rating");
      }
      if (node.itemReviewed && typeof node.itemReviewed === "object" && !hasStructuredValue(node.itemReviewed, "name")) {
        addDiagnostic("warning", "missing_required", structuredTypes(node.itemReviewed)[0] || "Reviewed item", "name", "Reviewed item");
      }
    }

    if (types.includes("EmployerAggregateRating") && node.itemReviewed && typeof node.itemReviewed === "object") {
      if (!hasStructuredValue(node.itemReviewed, "name")) {
        addDiagnostic("warning", "missing_required", "Organization", "name", "Rated employer");
      }
      if (!hasStructuredValue(node.itemReviewed, "sameAs")) {
        addDiagnostic("notice", "missing_recommended", "Organization", "sameAs", "Rated employer");
      }
    }

    if (types.includes("ClaimReview") && node.reviewRating && typeof node.reviewRating === "object") {
      if (!hasStructuredValue(node.reviewRating, "ratingValue")) {
        addDiagnostic("warning", "missing_required", "Rating", "ratingValue", "Claim review rating");
      }
      if (!hasStructuredValue(node.reviewRating, "bestRating")) {
        addDiagnostic("warning", "missing_required", "Rating", "bestRating", "Claim review rating");
      }
      if (!hasStructuredValue(node.reviewRating, "worstRating")) {
        addDiagnostic("warning", "missing_required", "Rating", "worstRating", "Claim review rating");
      }
    }

    if (types.includes("ImageObject")) {
      const creator = node.creator;
      if (creator && typeof creator === "object" && !hasStructuredValue(creator, "name")) {
        addDiagnostic("warning", "missing_required", structuredTypes(creator)[0] || "Creator", "name", "Image creator");
      }
    }

    if (types.includes("VacationRental")) {
      const places = Array.isArray(node.containsPlace) ? node.containsPlace : node.containsPlace ? [node.containsPlace] : [];
      places.forEach((place, index) => {
        if (!hasStructuredValue(place, "occupancy")) {
          addDiagnostic("warning", "missing_required", "Accommodation", "occupancy", `Unit ${index + 1}`);
        }
        const occupancy = place?.occupancy;
        if (occupancy && typeof occupancy === "object" && !isNonNegativeNumber(occupancy.maxValue)) {
          addDiagnostic("warning", "invalid_value", "QuantitativeValue", "maxValue", `Unit ${index + 1}`);
        }
      });
      const images = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
      if (images.length && images.length < 8) {
        addDiagnostic("notice", "insufficient_images", primaryType, "image", `${images.length} image(s); Google recommends at least 8`);
      }
    }

    if (types.includes("VideoObject")) {
      const clips = Array.isArray(node.hasPart) ? node.hasPart : node.hasPart ? [node.hasPart] : [];
      clips.filter((clip) => structuredTypes(clip).includes("Clip")).forEach((clip, index) => {
        if (!hasStructuredValue(clip, "name")) addDiagnostic("warning", "missing_required", "Clip", "name", `Clip ${index + 1}`);
        if (!isNonNegativeNumber(clip.startOffset)) addDiagnostic("warning", "invalid_value", "Clip", "startOffset", `Clip ${index + 1}`);
        if (!hasStructuredValue(clip, "url")) addDiagnostic("warning", "missing_required", "Clip", "url", `Clip ${index + 1}`);
      });
    }

    if (types.includes("MathSolver")) {
      const actions = Array.isArray(node.potentialAction) ? node.potentialAction : node.potentialAction ? [node.potentialAction] : [];
      actions.forEach((action, index) => {
        if (!hasStructuredValue(action, "target")) addDiagnostic("warning", "missing_required", "SolveMathAction", "target", `Action ${index + 1}`);
        if (!hasStructuredValue(action, "mathExpression-input")) {
          addDiagnostic("warning", "missing_required", "SolveMathAction", "mathExpression-input", `Action ${index + 1}`);
        }
        if (!hasStructuredValue(action, "eduQuestionType")) {
          addDiagnostic("notice", "missing_recommended", "SolveMathAction", "eduQuestionType", `Action ${index + 1}`);
        }
      });
    }

    if (node.speakable && typeof node.speakable === "object") {
      if (!hasStructuredValue(node.speakable, "cssSelector") && !hasStructuredValue(node.speakable, "xpath")) {
        addDiagnostic("warning", "missing_required_any", "SpeakableSpecification", "cssSelector / xpath", primaryType);
      }
    }

    if (node.isAccessibleForFree === false || node.isAccessibleForFree === "false") {
      const parts = Array.isArray(node.hasPart) ? node.hasPart : node.hasPart ? [node.hasPart] : [];
      const paywalledParts = parts.filter((part) => part?.isAccessibleForFree === false || part?.isAccessibleForFree === "false");
      if (!paywalledParts.length) {
        addDiagnostic("warning", "missing_required", primaryType, "hasPart", "Paywalled content needs a marked-up paywalled section");
      }
      paywalledParts.forEach((part, index) => {
        if (!hasStructuredValue(part, "cssSelector")) {
          addDiagnostic("warning", "missing_required", "WebPageElement", "cssSelector", `Paywalled section ${index + 1}`);
        }
      });
    }

    if (types.includes("Dataset")) {
      const descriptionLength = String(node.description || "").trim().length;
      if (descriptionLength && descriptionLength < 50) {
        addDiagnostic("warning", "invalid_length", primaryType, "description", `${descriptionLength} characters; Google requires at least 50`);
      }
      const distributions = Array.isArray(node.distribution) ? node.distribution : node.distribution ? [node.distribution] : [];
      distributions.forEach((distribution, index) => {
        if (!hasStructuredValue(distribution, "contentUrl")) {
          addDiagnostic("warning", "missing_required", "DataDownload", "contentUrl", `Distribution ${index + 1}`);
        }
      });
    }

    if (types.includes("ProfilePage") && node.mainEntity) {
      const entities = Array.isArray(node.mainEntity) ? node.mainEntity : [node.mainEntity];
      entities.forEach((entity, index) => {
        if (!hasStructuredValue(entity, "name") && !hasStructuredValue(entity, "alternateName")) {
          addDiagnostic("warning", "missing_required_any", structuredTypes(entity)[0] || "Profile entity", "name / alternateName", `Profile entity ${index + 1}`);
        }
      });
    }

    if (types.includes("QAPage") && node.mainEntity) {
      const questions = Array.isArray(node.mainEntity) ? node.mainEntity : [node.mainEntity];
      if (questions.length !== 1) addDiagnostic("warning", "invalid_count", primaryType, "mainEntity", `Expected one Question, found ${questions.length}`);
      questions.forEach((question, index) => {
        if (!hasStructuredValue(question, "name")) addDiagnostic("warning", "missing_required", "Question", "name", `Question ${index + 1}`);
        if (!isNonNegativeNumber(question.answerCount)) addDiagnostic("warning", "invalid_value", "Question", "answerCount", `Question ${index + 1}`);
        if (!hasStructuredValue(question, "acceptedAnswer") && !hasStructuredValue(question, "suggestedAnswer")) {
          addDiagnostic("warning", "missing_required_any", "Question", "acceptedAnswer / suggestedAnswer", `Question ${index + 1}`);
        }
        const answers = [
          ...(Array.isArray(question.acceptedAnswer) ? question.acceptedAnswer : question.acceptedAnswer ? [question.acceptedAnswer] : []),
          ...(Array.isArray(question.suggestedAnswer) ? question.suggestedAnswer : question.suggestedAnswer ? [question.suggestedAnswer] : []),
        ];
        answers.forEach((answer, answerIndex) => {
          if (!hasStructuredValue(answer, "text")) addDiagnostic("warning", "missing_required", "Answer", "text", `Answer ${answerIndex + 1}`);
        });
      });
    }

    if (types.includes("DiscussionForumPosting") || types.includes("SocialMediaPosting")) {
      const authors = Array.isArray(node.author) ? node.author : node.author ? [node.author] : [];
      authors.forEach((author, index) => {
        if (!hasStructuredValue(author, "name")) addDiagnostic("warning", "missing_required", "Author", "name", `Author ${index + 1}`);
      });
      const comments = Array.isArray(node.comment) ? node.comment : node.comment ? [node.comment] : [];
      comments.forEach((comment, index) => {
        if (!hasStructuredValue(comment, "author")) addDiagnostic("warning", "missing_required", "Comment", "author", `Comment ${index + 1}`);
        if (!hasStructuredValue(comment, "datePublished")) addDiagnostic("warning", "missing_required", "Comment", "datePublished", `Comment ${index + 1}`);
        if (!hasStructuredValue(comment, "text") && !hasStructuredValue(comment, "image") && !hasStructuredValue(comment, "video")) {
          addDiagnostic("warning", "missing_required_any", "Comment", "text / image / video", `Comment ${index + 1}`);
        }
      });
    }

    if (types.some((type) => LOCAL_BUSINESS_TYPES.has(type)) && node.address && typeof node.address === "object") {
      if (!hasStructuredValue(node.address, "streetAddress")) {
        addDiagnostic("notice", "missing_recommended", "PostalAddress", "streetAddress", primaryType);
      }
      if (!hasStructuredValue(node.address, "addressLocality")) {
        addDiagnostic("notice", "missing_recommended", "PostalAddress", "addressLocality", primaryType);
      }
      if (!hasStructuredValue(node.address, "addressCountry")) {
        addDiagnostic("notice", "missing_recommended", "PostalAddress", "addressCountry", primaryType);
      }
    }

    if (types.includes("Event") && node.location && typeof node.location === "object") {
      if (!hasStructuredValue(node.location, "name")) addDiagnostic("warning", "missing_required", "Place", "name", "Event location");
      if (!hasStructuredValue(node.location, "address") && !hasStructuredValue(node.location, "url")) {
        addDiagnostic("warning", "missing_required_any", "Place", "address / url", "Event location");
      }
    }

    if (types.includes("JobPosting")) {
      if (node.hiringOrganization && typeof node.hiringOrganization === "object" && !hasStructuredValue(node.hiringOrganization, "name")) {
        addDiagnostic("warning", "missing_required", "Organization", "name", "Hiring organization");
      }
      const locations = Array.isArray(node.jobLocation) ? node.jobLocation : node.jobLocation ? [node.jobLocation] : [];
      locations.forEach((location, index) => {
        if (!hasStructuredValue(location, "address")) {
          addDiagnostic("warning", "missing_required", "Place", "address", `Job location ${index + 1}`);
        }
      });
    }

    if (types.some((type) => ARTICLE_TYPES.has(type))) {
      const authors = Array.isArray(node.author) ? node.author : node.author ? [node.author] : [];
      authors.forEach((author, index) => {
        if (typeof author === "object" && !hasStructuredValue(author, "name")) {
          addDiagnostic("notice", "missing_recommended", structuredTypes(author)[0] || "Author", "name", `Author ${index + 1}`);
        }
      });
    }

    if (types.includes("ItemList") && Array.isArray(node.itemListElement)) {
      const positions = [];
      const urls = new Set();
      node.itemListElement.forEach((item, index) => {
        if (!isNonNegativeNumber(item?.position) || Number(item.position) < 1) {
          addDiagnostic("warning", "invalid_value", "ListItem", "position", `Item ${index + 1}`);
        } else {
          positions.push(Number(item.position));
        }
        const itemValue = item?.url || item?.item;
        const itemUrl = graphUrl(
          typeof itemValue === "string" ? itemValue : itemValue?.url || itemValue?.["@id"],
          baseUrl,
        );
        if (!itemUrl) addDiagnostic("warning", "missing_required", "ListItem", "url", `Item ${index + 1}`);
        else if (urls.has(itemUrl)) addDiagnostic("warning", "duplicate_value", "ListItem", "url", itemUrl);
        else urls.add(itemUrl);
      });
      const sortedPositions = [...positions].sort((a, b) => a - b);
      if (sortedPositions.some((position, index) => position !== index + 1)) {
        addDiagnostic("notice", "non_sequential", "ItemList", "position", sortedPositions.join(", "));
      }
    }

    for (const property of ["datePublished", "dateModified", "dateCreated", "uploadDate", "startDate", "endDate", "datePosted", "validThrough"]) {
      if (hasStructuredValue(node, property) && !isIsoDate(node[property])) {
        addDiagnostic("warning", "invalid_date", primaryType, property, String(node[property]));
      }
    }
    for (const property of ["ratingValue", "ratingCount", "reviewCount", "bestRating", "worstRating", "commentCount", "answerCount", "upvoteCount"]) {
      if (hasStructuredValue(node, property) && !isNonNegativeNumber(node[property])) {
        addDiagnostic("warning", "invalid_number", primaryType, property, String(node[property]));
      }
    }
    const ratings = [node.aggregateRating, node.reviewRating].flat().filter(Boolean);
    ratings.forEach((rating, index) => {
      if (!hasStructuredValue(rating, "ratingValue")) addDiagnostic("warning", "missing_required", "Rating", "ratingValue", `Rating ${index + 1}`);
      if (!hasStructuredValue(rating, "ratingCount") && !hasStructuredValue(rating, "reviewCount") && node.aggregateRating) {
        addDiagnostic("warning", "missing_required_any", "AggregateRating", "ratingCount / reviewCount", `Rating ${index + 1}`);
      }
    });

    const pageUrlValue = node.url || node.mainEntityOfPage?.["@id"] || node.mainEntityOfPage;
    const structuredPageUrl = typeof pageUrlValue === "string" ? graphUrl(pageUrlValue, baseUrl) : "";
    if (structuredPageUrl && normalizeUrl(structuredPageUrl) !== normalizeUrl(baseUrl)) {
      addDiagnostic("notice", "page_url_mismatch", primaryType, "url", structuredPageUrl);
    }
    const structuredName = String(node.headline || node.name || "").trim();
    if (structuredName && pageTitle && !pageTitle.toLowerCase().includes(structuredName.toLowerCase()) && !structuredName.toLowerCase().includes(pageTitle.toLowerCase())) {
      addDiagnostic("notice", "name_mismatch", primaryType, node.headline ? "headline" : "name", `Structured data: ${structuredName} | Page title: ${pageTitle}`);
    }
    if (structuredName && !visibleText.includes(structuredName.toLowerCase())) {
      addDiagnostic("notice", "name_not_visible", primaryType, node.headline ? "headline" : "name", structuredName);
    }
    for (const property of ["url", "image", "logo", "thumbnailUrl", "contentUrl", "embedUrl"]) {
      const values = Array.isArray(node[property]) ? node[property] : node[property] != null ? [node[property]] : [];
      for (const value of values) {
        const rawUrl = typeof value === "string" ? value : value?.url || value?.["@id"];
        const resolvedUrl = rawUrl ? graphUrl(rawUrl, baseUrl) : "";
        if (rawUrl && !resolvedUrl) addDiagnostic("warning", "invalid_url", primaryType, property, String(rawUrl));
        if (resolvedUrl && ["image", "thumbnailUrl"].includes(property) && !visibleImages.has(resolvedUrl)) {
          addDiagnostic("notice", "image_not_visible", primaryType, property, resolvedUrl);
        }
      }
    }
  }

  const types = [...new Set(summaries.flatMap((node) => node.types))];
  return {
    count: blocks.length + invalidCount,
    validCount: blocks.length,
    invalidCount,
    nodeCount: nodes.length,
    types,
    nodes: summaries.slice(0, 100),
    validatedTypes: [...new Set(summaries.filter((node) => node.validated).flatMap((node) => node.types))],
    unvalidatedTypes: [...new Set(summaries.filter((node) => !node.validated).flatMap((node) => node.types))],
    diagnostics: diagnostics.slice(0, 100),
  };
}
