import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, DATABASE_ID, USER_PROFILE_COLLECTION } from "@/lib/appwrite-server";
import { extractProfile, refineProfile, generateProfileFromAnswers } from "@/lib/ai/train";
import { seedFromProfile } from "@/lib/ai/seed";
import { ID, Query } from "node-appwrite";
import type { ManualTrainAnswers, ParsedProfile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { userId, step, context, questions, answers, profile: importedProfile, manualAnswers } = await request.json();

    if (!userId || !step) {
      return NextResponse.json(
        { error: "userId and step are required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    if (step === "initial") {
      if (!context?.trim()) {
        return NextResponse.json(
          { error: "context is required for initial step" },
          { status: 400 }
        );
      }

      const result = await extractProfile(context, userId);

      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      const profileData = {
        userId,
        context,
        profile: JSON.stringify(result.profile),
        trainingComplete: result.followUpQuestions.length === 0,
        lastTrainedAt: new Date().toISOString(),
      };

      let doc;
      if (existing.total > 0) {
        doc = await databases.updateDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          existing.documents[0].$id,
          profileData
        );
      } else {
        doc = await databases.createDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          ID.unique(),
          profileData
        );
      }

      return NextResponse.json({
        profile: result.profile,
        followUpQuestions: result.followUpQuestions,
        trainingComplete: result.followUpQuestions.length === 0,
        documentId: doc.$id,
      });
    }

    if (step === "refine") {
      if (!questions?.length || !answers?.length) {
        return NextResponse.json(
          { error: "questions and answers are required for refine step" },
          { status: 400 }
        );
      }

      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (existing.total === 0) {
        return NextResponse.json(
          { error: "No profile found — run initial step first" },
          { status: 400 }
        );
      }

      const doc = existing.documents[0];
      const existingProfile: ParsedProfile = JSON.parse(doc.profile as string);

      const result = await refineProfile(existingProfile, questions, answers, userId);

      const updatedContext =
        (doc.context as string) +
        "\n\n--- Follow-up Answers ---\n" +
        questions.map((q: string, i: number) => `Q: ${q}\nA: ${answers[i] || "(skipped)"}`).join("\n\n");

      await databases.updateDocument(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        doc.$id,
        {
          context: updatedContext,
          profile: JSON.stringify(result.profile),
          trainingComplete: result.followUpQuestions.length === 0,
          lastTrainedAt: new Date().toISOString(),
        }
      );

      return NextResponse.json({
        profile: result.profile,
        followUpQuestions: result.followUpQuestions,
        trainingComplete: result.followUpQuestions.length === 0,
      });
    }

    if (step === "chatgpt-import") {
      if (!importedProfile) {
        return NextResponse.json(
          { error: "profile JSON is required for chatgpt-import step" },
          { status: 400 }
        );
      }

      const parsed = importedProfile as ParsedProfile;
      if (!parsed.businesses || !parsed.projects || !parsed.interests || !parsed.people || !parsed.goals) {
        return NextResponse.json(
          { error: "Invalid profile structure — missing required fields" },
          { status: 400 }
        );
      }

      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      const profileData = {
        userId,
        context: "[Imported from ChatGPT]",
        profile: JSON.stringify(parsed),
        trainingComplete: true,
        lastTrainedAt: new Date().toISOString(),
      };

      if (existing.total > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          existing.documents[0].$id,
          profileData
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          ID.unique(),
          profileData
        );
      }

      return NextResponse.json({
        profile: parsed,
        followUpQuestions: [],
        trainingComplete: true,
      });
    }

    if (step === "manual") {
      const typedAnswers = manualAnswers as ManualTrainAnswers | null;
      if (!typedAnswers) {
        return NextResponse.json(
          { error: "manualAnswers is required for manual step" },
          { status: 400 }
        );
      }

      const result = await generateProfileFromAnswers(typedAnswers, userId);

      const contextSummary = [
        typedAnswers.name && `Name: ${typedAnswers.name}`,
        typedAnswers.work && `Work: ${typedAnswers.work}`,
        typedAnswers.businesses.length > 0 && `Businesses: ${typedAnswers.businesses.map((b) => b.name).join(", ")}`,
        typedAnswers.projects.length > 0 && `Projects: ${typedAnswers.projects.map((p) => p.name).join(", ")}`,
        typedAnswers.goals.length > 0 && `Goals: ${typedAnswers.goals.join(", ")}`,
        typedAnswers.interests.length > 0 && `Interests: ${typedAnswers.interests.join(", ")}`,
        typedAnswers.people.length > 0 && `People: ${typedAnswers.people.map((p) => p.name).join(", ")}`,
      ].filter(Boolean).join("\n");

      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      const profileData = {
        userId,
        context: contextSummary,
        profile: JSON.stringify(result.profile),
        trainingComplete: true,
        lastTrainedAt: new Date().toISOString(),
      };

      if (existing.total > 0) {
        await databases.updateDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          existing.documents[0].$id,
          profileData
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          USER_PROFILE_COLLECTION,
          ID.unique(),
          profileData
        );
      }

      return NextResponse.json({
        profile: result.profile,
        followUpQuestions: [],
        trainingComplete: true,
      });
    }

    if (step === "update-profile") {
      if (!importedProfile) {
        return NextResponse.json(
          { error: "profile is required for update-profile step" },
          { status: 400 }
        );
      }

      const parsed = importedProfile as ParsedProfile;

      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (existing.total === 0) {
        return NextResponse.json(
          { error: "No profile found — run training first" },
          { status: 400 }
        );
      }

      await databases.updateDocument(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        existing.documents[0].$id,
        {
          profile: JSON.stringify(parsed),
          lastTrainedAt: new Date().toISOString(),
        }
      );

      return NextResponse.json({
        profile: parsed,
        trainingComplete: true,
      });
    }

    if (step === "seed") {
      const existing = await databases.listDocuments(
        DATABASE_ID,
        USER_PROFILE_COLLECTION,
        [Query.equal("userId", userId), Query.limit(1)]
      );

      if (existing.total === 0) {
        return NextResponse.json(
          { error: "No profile found — run training first" },
          { status: 400 }
        );
      }

      const doc = existing.documents[0];
      const existingProfile: ParsedProfile = JSON.parse(doc.profile as string);
      const storedContext = (doc.context as string) || "";

      const result = await seedFromProfile(userId, existingProfile, storedContext);

      return NextResponse.json({
        success: true,
        categoriesCreated: result.categoriesCreated,
        notesCreated: result.notesCreated,
      });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/train:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const { databases } = createAdminClient();

    const existing = await databases.listDocuments(
      DATABASE_ID,
      USER_PROFILE_COLLECTION,
      [Query.equal("userId", userId), Query.limit(1)]
    );

    if (existing.total === 0) {
      return NextResponse.json({ profile: null, trainingComplete: false });
    }

    const doc = existing.documents[0];
    return NextResponse.json({
      profile: JSON.parse(doc.profile as string),
      trainingComplete: doc.trainingComplete as boolean,
      lastTrainedAt: doc.lastTrainedAt as string,
    });
  } catch (error) {
    console.error("Error in GET /api/train:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
