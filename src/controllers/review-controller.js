import Review from '../models/review.model.js';
import User from '../models/user.model.js';

/**
 * GET /api/reviews/:doctorId
 * List all reviews for a specific doctor
 */
export const listDoctorReviews = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Verify doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const reviews = await Review.find({ doctorId })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    return res.json({
      success: true,
      data: reviews,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (err) {
    console.error('listDoctorReviews error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * POST /api/reviews
 * Create or update a review (patient only)
 */
export const createOrUpdateReview = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { doctorId, rating, text } = req.body;

    if (!doctorId || !rating) {
      return res.status(400).json({ success: false, message: 'doctorId and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Verify doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Check if review already exists
    let review = await Review.findOne({ doctorId, patientId });

    if (review) {
      // Update existing review
      review.rating = rating;
      review.text = text || review.text;
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        doctorId,
        patientId,
        rating,
        text: text || ''
      });
    }

    await review.populate('patientId', 'name email');
    await review.populate('doctorId', 'name specialty');

    return res.json({
      success: true,
      message: review.isNew ? 'Review created' : 'Review updated',
      data: review
    });
  } catch (err) {
    console.error('createOrUpdateReview error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * GET /api/reviews/me/doctor
 * Get all reviews for the currently logged-in doctor
 */
export const getMyDoctorReviews = async (req, res) => {
  try {
    const doctorId = req.user.id;
    
    // Verify user is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can access this endpoint' });
    }

    const reviews = await Review.find({ doctorId })
      .populate('patientId', 'name email')
      .populate('doctorId', 'name specialty')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    return res.json({
      success: true,
      data: reviews,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (err) {
    console.error('getMyDoctorReviews error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * DELETE /api/reviews/:id
 * Delete a review (admin only)
 */
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await Review.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: 'Review deleted'
    });
  } catch (err) {
    console.error('deleteReview error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
