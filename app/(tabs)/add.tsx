import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Plus, Mic, Send, MessageSquarePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { AIService } from '@/services/AIService';
import { DatabaseService } from '@/services/DatabaseService';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function AddInteractionScreen() {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [conversationState, setConversationState] = useState('initial'); // 'initial', 'awaiting_reminder_response'
  const [lastProcessedData, setLastProcessedData] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const inputRef = useRef(null);
  const { isDark } = useTheme();

  const theme = {
    text: '#f0f0f0',
    background: isDark ? '#0B0909' : '#003C24',
    primary: isDark ? '#8C8C8C' : '#f0f0f0',
    secondary: isDark ? '#4A5568' : '#012d1c',
    accent: isDark ? '#44444C' : '#002818',
    inputBackground: isDark ? '#1A1A1A' : '#002818',
    border: isDark ? '#333333' : '#012d1c',
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) {
      Alert.alert('Input Required', 'Please describe your interaction first.');
      return;
    }

    setIsProcessing(true);
    try {
      if (conversationState === 'initial') {
        // Process the natural language input with AI
        const extractedData = await AIService.processInteraction(inputText);
        
        // Add selected image to profile data if available
        if (selectedImage) {
          extractedData.profile.photoUri = selectedImage.uri;
        }
        
        // Save to database
        const profileId = await DatabaseService.createOrUpdateProfile(extractedData.profile);
        
        // Save interaction
        await DatabaseService.addInteraction({
          profileId,
          description: inputText,
          extractedData: JSON.stringify(extractedData),
          createdAt: new Date().toISOString()
        });

        // Store the data for potential reminder creation
        setLastProcessedData({ ...extractedData, profileId });
        
        // Add AI response with reminder suggestion
        const aiMessage = `Great! I've added ${extractedData.profile.name} to your contacts.`;
        let reminderMessage = '';
        
        if (extractedData.suggestedReminder) {
          reminderMessage = `\n\nI suggest creating a reminder: "${extractedData.suggestedReminder.title}" - ${extractedData.suggestedReminder.description}. Should I set this for ${extractedData.suggestedReminder.suggestedDays} days from now?`;
          setConversationState('awaiting_reminder_response');
        }
        
        setChatMessages(prev => [...prev, { 
          type: 'user', 
          text: inputText 
        }, { 
          type: 'ai', 
          text: aiMessage + reminderMessage
        }]);
        
        if (!extractedData.suggestedReminder) {
          // No reminder suggested, show success and reset
          setTimeout(() => {
            setInputText('');
            setChatMessages([]);
            setSelectedImage(null);
            inputRef.current?.focus();
          }, 2000);
        }
      } else if (conversationState === 'awaiting_reminder_response') {
        // Process reminder response
        const reminderResponse = await AIService.processReminderResponse(inputText, lastProcessedData);
        
        // Add both user message and AI response
        setChatMessages(prev => [...prev, { 
          type: 'user', 
          text: inputText 
        }, { 
          type: 'ai', 
          text: reminderResponse.response 
        }]);
        
        if (reminderResponse.action === 'create') {
          // Create the reminder
          await DatabaseService.createReminder({
            profileId: lastProcessedData.profileId,
            title: reminderResponse.title,
            description: reminderResponse.description,
            scheduledFor: reminderResponse.scheduledFor,
            type: reminderResponse.type
          });
        }
        
        // Reset conversation
        setTimeout(() => {
          setConversationState('initial');
          setLastProcessedData(null);
          setInputText('');
          setChatMessages([]);
          setSelectedImage(null);
          inputRef.current?.focus();
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing interaction:', error);
      Alert.alert('Error', 'Failed to process interaction. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleVoiceInput = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Voice Input',
        'Voice input is not available on web. Please type your interaction.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsListening(true);
      // Note: This is a placeholder for voice-to-text functionality
      // In a real implementation, you would use expo-speech or react-native-voice
      Alert.alert(
        'Voice Input',
        'Voice input feature coming soon! For now, please type your interaction.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error with voice input:', error);
      Alert.alert('Error', 'Failed to start voice input. Please try again.');
    } finally {
      setIsListening(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <MessageSquarePlus size={32} color={theme.text} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>ARMi Chat</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.welcomeMessage}>
            <Text style={[styles.welcomeText, { color: theme.text }]}>
              Tell me about someone in your life
            </Text>
            <Text style={[styles.welcomeSubtext, { color: theme.primary }]}>
              I'll help you remember the important details and stay connected
            </Text>
          </View>

          {chatMessages.map((message, index) => (
            <View key={index} style={styles.messageContainer}>
              <View style={[
                message.type === 'user' ? styles.userMessage : styles.botMessage,
                { backgroundColor: message.type === 'user' ? theme.secondary : theme.accent }
              ]}>
                <Text style={[styles.messageText, { 
                  color: message.type === 'user' ? '#FFFFFF' : theme.text 
                }]}>
                  {message.text}
                </Text>
              </View>
            </View>
          ))}

          {isProcessing && (
            <View style={styles.messageContainer}>
              <View style={[styles.botMessage, { backgroundColor: theme.accent }]}>
                <Text style={[styles.messageText, { color: theme.text }]}>
                  {conversationState === 'initial' ? 'Processing your interaction with AI...' : 'Processing your response...'}
                </Text>
              </View>
            </View>
          )}

          {selectedImage && (
            <View style={styles.messageContainer}>
              <View style={[styles.imagePreview, { backgroundColor: theme.accent }]}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <TouchableOpacity 
                  style={[styles.removeImageButton, { backgroundColor: theme.secondary }]}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={[styles.inputRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={handleAddPhoto}
            >
              <Plus size={20} color={theme.primary} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: theme.text }]}
              multiline
              placeholder={conversationState === 'initial' ? "Who did you meet today..." : "Your response..."}
              placeholderTextColor={theme.primary}
              value={inputText}
              onChangeText={setInputText}
              maxLength={1000}
              autoFocus
            />

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.accent }]}
              onPress={handleVoiceInput}
            >
              <Mic size={20} color={isListening ? theme.secondary : theme.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
             { backgroundColor: inputText.trim() && !isProcessing ? theme.secondary : theme.secondary },
              (!inputText.trim() || isProcessing) && styles.sendButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!inputText.trim() || isProcessing}
          >
           <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  welcomeMessage: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 25,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginRight: 12,
    minHeight: 50,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 120,
    minHeight: 36,
    letterSpacing: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  imagePreview: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    padding: 8,
    position: 'relative',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});