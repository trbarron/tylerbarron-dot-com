import { json, LoaderFunction } from "@remix-run/node";
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Configure DynamoDB
const client = new DynamoDB({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: process.env.AWS_REGION
});

const dynamoDb = DynamoDBDocument.from(client);

type ScoresData = {
    userScore: string | null;
    userRank: number | null;
    totalUsers: number | null;
    topScores: Array<{ userName: string; score: number }>;
};

async function getScores(username: string): Promise<ScoresData> {
    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    const params = {
        TableName: "cgUserData",
        FilterExpression: "contains(#date, :dateVal)",
        ExpressionAttributeNames: {
            "#date": "date",
        },
        ExpressionAttributeValues: {
            ":dateVal": currentDate,
        }
    };

    try {
        const data = await dynamoDb.scan(params);
        const scores = data.Items?.map(item => ({
            userName: item.userData.split('#')[0],
            score: item.score,
            date: item.date
        })).filter(item => item.date === currentDate) || [];

        scores.sort((a, b) => a.score - b.score);

        const userIndex = scores.findIndex(item => item.userName === username);
        const userScore = scores[userIndex];
        const userRank = userIndex + 1;
        const totalUsers = scores.length;
        const topScores = scores.slice(0, 5);

        return {
            userScore: userScore ? userScore.score.toFixed(2) : null,
            userRank,
            totalUsers,
            topScores
        };
    } catch (error) {
        console.error("Error fetching scores from DynamoDB:", error);
        return {
            userScore: null,
            userRank: null,
            totalUsers: null,
            topScores: []
        };
    }
}

export const loader: LoaderFunction = async ({ params }) => {
    const username = params.username;
  
    if (!username) {
        return json({ error: "Username is required" }, { status: 400 });
    }

    try {
        const scoresData = await getScores(username);
        return json(scoresData);
    } catch (error) {
        console.error("Error fetching scores:", error);
        return json({ error: "Failed to fetch scores" }, { status: 500 });
    }
};