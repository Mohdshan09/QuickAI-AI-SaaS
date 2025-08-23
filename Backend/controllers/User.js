import sql from "../config/Neon.js";

export const getUserCreations = async (req, res) => {
  try {
    const { userId } = req.auth();

    const creations = await sql`SELECT*FROM creations 
        WHERE user_id = ${userId}
        ORDER BY created_At  DESC
        `;

    res.json({
      success: true,
      creations,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error,
    });
  }
};

export const getPublishCreations = async (req, res) => {
  try {
    const creations = await sql`SELECT*FROM creations 
        WHERE publish = true
        ORDER BY created_at  DESC
        `;

    res.json({
      success: true,
      creations,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "No published creations !",
    });
  }
};

export const toggleLikesCreations = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    const [creations] = await sql`SELECT*FROM creations 
        WHERE id = ${id}
        `;

    if (!creations) {
      return res.json({
        success: false,
        message: "creation not found !",
      });
    }

    const currLikes = creations.likes;
    const useridString = userId.toString();
    let updateLikes;
    let message;

    if (currLikes.includes(useridString)) {
      updateLikes = currLikes.filter((user) => user !== useridString);
      message = "Creation Unliked";
    } else {
      updateLikes = [...currLikes, useridString];
      message = "Creation Liked";
    }

    const formattedArray = `{${updateLikes.join(",")}}`;

    await sql`UPDATE creations
    SET likes = ${formattedArray}::text[]
    WHERE id = ${id}

    `;

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
};
